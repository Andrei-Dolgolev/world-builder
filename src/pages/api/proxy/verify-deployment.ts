import type { NextApiRequest, NextApiResponse } from 'next';

type VerificationResponse = {
    status: 'success' | 'pending' | 'failed';
    message: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<VerificationResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            status: 'failed',
            message: 'Method not allowed'
        });
    }

    try {
        const { deploymentUrl } = req.body;

        if (!deploymentUrl) {
            return res.status(400).json({
                status: 'failed',
                message: 'Missing deploymentUrl parameter'
            });
        }

        // Try to fetch the deployed game to verify it's accessible
        try {
            const response = await fetch(deploymentUrl, {
                method: 'HEAD',
                headers: { 'Cache-Control': 'no-cache' },
            });

            if (response.ok) {
                return res.status(200).json({
                    status: 'success',
                    message: 'Deployment verified and accessible'
                });
            } else {
                return res.status(200).json({
                    status: 'pending',
                    message: `Deployment might still be propagating (Status: ${response.status})`
                });
            }
        } catch (fetchError) {
            return res.status(200).json({
                status: 'pending',
                message: 'Deployment is still propagating. Try again in a few moments.'
            });
        }
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({
            status: 'failed',
            message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
} 