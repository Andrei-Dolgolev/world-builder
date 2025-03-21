import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

// Type definitions for our API
type DeploymentRequest = {
    gameCode: string;
    assets?: Record<string, string>; // filename -> base64 content
    projectName: string;
    username?: string;
    customSubdomain?: string;
};

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
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            deploymentUrl: '',
            message: 'Method not allowed',
        });
    }

    try {
        const { gameCode, assets, projectName, username, customSubdomain } = req.body as DeploymentRequest;

        if (!gameCode || !projectName) {
            return res.status(400).json({
                success: false,
                deploymentUrl: '',
                message: 'Missing required fields: gameCode and projectName',
            });
        }

        // Initialize AWS SDK
        const s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-west-2',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });

        // Generate a unique ID for the deployment
        const deploymentId = customSubdomain || `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${uuidv4().substring(0, 8)}`;

        // Generate HTML content with embedded game code
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        canvas {
            display: block;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <script>
        ${gameCode}
    </script>
</body>
</html>
        `;

        // Call the Lambda API to register the subdomain
        const lambdaApiUrl = process.env.WORLDBUILDER_API_URL || 'https://<your-lambda-api-url>.execute-api.us-west-2.amazonaws.com/prod/register-subdomain';
        console.log('WORLDBUILDER_API_URL', lambdaApiUrl);

        // Send the registration request to the Lambda API
        const registerResponse = await fetch(lambdaApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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

        const responseData = await registerResponse.json();

        // If there are assets, upload them using the upload-files endpoint
        if (assets && Object.keys(assets).length > 0) {
            const uploadUrlsEndpoint = lambdaApiUrl.replace('register-subdomain', 'generate-upload-urls');

            // Prepare the files metadata
            const files = Object.keys(assets).map(name => ({
                path: `assets/${name}`,
                contentType: getContentType(name)
            }));

            // Get presigned URLs for uploads
            const uploadUrlsResponse = await fetch(uploadUrlsEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subdomain: deploymentId,
                    userId: username || 'anonymous',
                    files
                }),
            });

            if (uploadUrlsResponse.ok) {
                const urlsData = await uploadUrlsResponse.json();

                // Upload assets using presigned URLs
                for (const urlInfo of urlsData.uploadUrls) {
                    const assetName = urlInfo.path.replace('assets/', '');
                    const assetData = assets[assetName];

                    if (assetData) {
                        await fetch(urlInfo.url, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': getContentType(assetName)
                            },
                            body: Buffer.from(assetData.replace(/^data:[^;]+;base64,/, ''), 'base64')
                        });
                    }
                }
            }
        }

        // Construct the URL for the deployed game
        const baseDomain = process.env.BASE_DOMAIN || 'app.worldbuilder.space';
        const deploymentUrl = `https://${deploymentId}.${baseDomain}`;

        return res.status(200).json({
            success: true,
            message: 'Game deployed successfully',
            deploymentUrl,
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