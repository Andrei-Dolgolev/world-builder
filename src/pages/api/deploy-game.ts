import type { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, PutObjectCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
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

// AWS S3 client configuration
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

// S3 bucket for deployments
const DEPLOYMENT_BUCKET = process.env.DEPLOYMENT_BUCKET || 'worldbuilder-games';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'worldbuilder.games';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<DeploymentResponse>
) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            deploymentUrl: '',
            message: 'Method not allowed'
        });
    }

    try {
        const { gameCode, assets, projectName, username, customSubdomain } = req.body as DeploymentRequest;

        // Validate required fields
        if (!gameCode || !projectName) {
            return res.status(400).json({
                success: false,
                deploymentUrl: '',
                message: 'Missing required fields: gameCode and projectName'
            });
        }

        // Generate a deployment ID and subdomain
        const deploymentId = uuidv4().substring(0, 8);
        const sanitizedProject = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Determine the subdomain
        let subdomain;
        if (customSubdomain) {
            subdomain = customSubdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
        } else if (username) {
            subdomain = `${sanitizedProject}.${username}`;
        } else {
            subdomain = `${sanitizedProject}-${deploymentId}`;
        }

        // Create the base HTML file with embedded game code
        const htmlContent = generateGameHtml(gameCode, projectName);

        // Create a deployment package
        const deploymentPrefix = `deployments/${subdomain}/`;

        // Upload HTML file
        await s3Client.send(new PutObjectCommand({
            Bucket: DEPLOYMENT_BUCKET,
            Key: `${deploymentPrefix}index.html`,
            Body: htmlContent,
            ContentType: 'text/html',
            ACL: 'public-read'
        }));

        // Upload assets if provided
        if (assets && Object.keys(assets).length > 0) {
            for (const [filename, content] of Object.entries(assets)) {
                // Determine content type based on file extension
                const contentType = getContentTypeFromFilename(filename);

                // Convert base64 to buffer if it's a base64 string
                let fileContent: Buffer;
                if (content.startsWith('data:')) {
                    const base64Data = content.split(',')[1];
                    fileContent = Buffer.from(base64Data, 'base64');
                } else {
                    fileContent = Buffer.from(content);
                }

                await s3Client.send(new PutObjectCommand({
                    Bucket: DEPLOYMENT_BUCKET,
                    Key: `${deploymentPrefix}assets/${filename}`,
                    Body: fileContent,
                    ContentType: contentType,
                    ACL: 'public-read'
                }));
            }
        }

        // Generate the deployment URL
        const deploymentUrl = `https://${subdomain}.${BASE_DOMAIN}`;

        // Return success with deployment URL
        return res.status(200).json({
            success: true,
            deploymentUrl,
            message: 'Game deployed successfully',
            deploymentId
        });

    } catch (error) {
        console.error('Deployment error:', error);
        return res.status(500).json({
            success: false,
            deploymentUrl: '',
            message: `Deployment failed: ${(error as Error).message}`
        });
    }
}

// Helper function to generate HTML with embedded game
function generateGameHtml(gameCode: string, title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - World Builder Game</title>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js"></script>
  <style>
    body { margin: 0; padding: 0; background: #000; }
    canvas { display: block; margin: 0 auto; }
  </style>
</head>
<body>
  <script>
    ${gameCode}
  </script>
</body>
</html>`;
}

// Helper function to determine content type from filename
function getContentTypeFromFilename(filename: string): string {
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
        'json': 'application/json',
        'js': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'txt': 'text/plain'
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
} 