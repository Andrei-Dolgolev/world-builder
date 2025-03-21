import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import axios from 'axios';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get user session for authentication
        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { subdomain, htmlContent } = req.body;

        if (!subdomain || !htmlContent) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get the API URL from environment variables
        const apiUrl = process.env.WORLDBUILDER_API_URL;

        if (!apiUrl) {
            return res.status(500).json({ error: 'API URL not configured' });
        }

        // Forward request to AWS API Gateway
        const response = await axios.post(apiUrl, {
            subdomain,
            htmlContent,
            userId: session.user.id, // Use the authenticated user's ID
        });

        return res.status(200).json(response.data);
    } catch (error) {
        console.error('Error creating space:', error);
        return res.status(500).json({ error: 'Failed to create space' });
    }
} 