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

        // Call the AWS Lambda API to check availability
        const apiUrl = process.env.WORLDBUILDER_API_URL?.replace('register-subdomain', 'check-subdomain');

        if (!apiUrl) {
            // Fallback: assume available if we can't check
            return res.status(200).json({
                available: true,
                message: 'Availability check not configured, assuming available'
            });
        }

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            // Add the subdomain as a query parameter
            // Note: Your API might expect this differently
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