import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

type DeploymentResponse = {
    success: boolean;
    deploymentUrl: string;
    message: string;
    deploymentId?: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<DeploymentResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            deploymentUrl: '',
            message: 'Method not allowed'
        });
    }

    try {
        const { gameCode, assets, projectName, username, customSubdomain } = req.body;

        if (!gameCode || !projectName) {
            return res.status(400).json({
                success: false,
                deploymentUrl: '',
                message: 'Missing required parameters'
            });
        }

        // Generate a unique ID for the deployment
        const deploymentId = customSubdomain ||
            `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}${username ? '-' + username.substring(0, 4) : ''}`;

        // Get the Lambda API URL from environment variables
        const lambdaApiUrl = process.env.WORLDBUILDER_API_URL;

        if (!lambdaApiUrl) {
            console.error('WORLDBUILDER_API_URL environment variable not set');
            return res.status(500).json({
                success: false,
                deploymentUrl: '',
                message: 'Server configuration error'
            });
        }

        console.log('WORLDBUILDER_API_URL', lambdaApiUrl);

        // Create HTML content with the game code
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <script src="https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js"></script>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎮</text></svg>">
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #000;
        }
        canvas {
            display: block;
            margin: 0 auto;
        }
        #loading {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 24px;
            z-index: 100;
        }
        #error {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: #ff5555;
            font-family: Arial, sans-serif;
            font-size: 18px;
            z-index: 200;
            padding: 20px;
            text-align: center;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .retry-btn {
            margin-top: 20px;
            padding: 10px 20px;
            background-color: #4a7aff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <div id="loading">
        <div class="spinner"></div>
        Loading game...
    </div>
    <div id="error">
        <h2>Oops! Something went wrong</h2>
        <p id="error-message">There was an error loading the game.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
    </div>
    <div id="game"></div>
    <script>
        // Error handling
        window.onerror = function(message, source, lineno, colno, error) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'flex';
            document.getElementById('error-message').textContent = 
                'Error: ' + message + ' (Line: ' + lineno + ')';
            return true;
        };
        
        // Hide loading screen when Phaser is ready
        window.onload = function() {
            try {
                document.getElementById('loading').style.display = 'none';
            } catch(e) {
                console.error('Error in onload:', e);
            }
        };

        ${gameCode}
    </script>
</body>
</html>`;

        // Register the subdomain
        try {
            const registerResponse = await fetch(lambdaApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subdomain: deploymentId,
                    userId: username || 'anonymous',
                    htmlContent: htmlContent,
                    path: 'index.html',
                    invalidateCache: true
                }),
            });

            if (!registerResponse.ok) {
                const errorData = await registerResponse.json();
                throw new Error(errorData.message || 'Failed to register subdomain');
            }
        } catch (error) {
            console.error('Error registering subdomain:', error);
            return res.status(500).json({
                success: false,
                deploymentUrl: '',
                message: `Failed to register subdomain: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }

        // Upload assets if any
        if (assets && Object.keys(assets).length > 0) {
            const uploadUrlsEndpoint = lambdaApiUrl.replace('register-subdomain', 'generate-upload-urls');
            const uploadUrlsResponse = await fetch(uploadUrlsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subdomain: deploymentId,
                    userId: username || 'anonymous',
                    files: Object.keys(assets).map(name => ({
                        path: `assets/${name}`,
                        contentType: getContentType(name)
                    }))
                }),
            });

            if (!uploadUrlsResponse.ok) {
                console.warn('Failed to generate upload URLs:', await uploadUrlsResponse.text());
            } else {
                const { uploadUrls } = await uploadUrlsResponse.json();

                // Upload each asset using the provided signed URLs
                for (const [name, url] of Object.entries(uploadUrls)) {
                    const assetKey = name.replace('assets/', '');
                    const assetContent = assets[assetKey];

                    // Base64 decode the asset content
                    const binary = atob(assetContent.split(',')[1]);
                    const array = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        array[i] = binary.charCodeAt(i);
                    }

                    const blob = new Blob([array], { type: getContentType(name) });

                    await fetch(url as string, {
                        method: 'PUT',
                        body: blob,
                        headers: {
                            'Content-Type': getContentType(name),
                        },
                    });
                }
            }
        }

        // Construct the deployment URL
        const deploymentUrl = `https://${deploymentId}.app.worldbuilder.space`;

        return res.status(200).json({
            success: true,
            message: 'Game deployed successfully',
            deploymentUrl,
            deploymentId,
        });
    } catch (error) {
        console.error('Deployment error:', error);
        return res.status(500).json({
            success: false,
            deploymentUrl: '',
            message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }
}

function getContentType(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'js': 'application/javascript',
        'json': 'application/json',
        'html': 'text/html',
        'css': 'text/css',
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
} 