import type { NextApiRequest, NextApiResponse } from 'next';

type CheckResponse = {
    available: boolean;
    message: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<CheckResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            available: false,
            message: 'Method not allowed'
        });
    }

    try {
        const { subdomain } = req.body;

        if (!subdomain) {
            return res.status(400).json({
                available: false,
                message: 'Missing subdomain parameter'
            });
        }

        // Validate subdomain format
        if (!/^[a-z0-9-]{3,63}$/.test(subdomain)) {
            return res.status(400).json({
                available: false,
                message: 'Invalid subdomain format'
            });
        }

        // Get the Lambda API URL from environment variables
        const lambdaApiUrl = process.env.WORLDBUILDER_API_URL;

        if (!lambdaApiUrl) {
            console.error('WORLDBUILDER_API_URL environment variable not set');
            return res.status(500).json({
                available: false,
                message: 'Server configuration error'
            });
        }

        // Call the AWS Lambda API to check availability
        const apiUrl = lambdaApiUrl.replace('register-subdomain', 'check-subdomain');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain })
        });

        if (!response.ok) {
            // If the check fails, we'll assume it's available to let the actual deployment try
            console.warn('Failed to check subdomain availability:', await response.text());
            return res.status(200).json({
                available: true,
                message: 'Could not verify availability, assuming available'
            });
        }

        const data = await response.json();
        return res.status(200).json({
            available: data.available !== false, // Default to available if not explicitly unavailable
            message: data.message || (data.available ? 'Subdomain is available' : 'Subdomain is not available')
        });
    } catch (error) {
        console.error('Error checking subdomain availability:', error);
        // Fallback to assuming available
        return res.status(200).json({
            available: true,
            message: 'Error checking availability, assuming available'
        });
    }
} 