import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const assetsFile = path.join(process.cwd(), 'public', 'assets.json');
            if (!fs.existsSync(assetsFile)) {
                return res.status(200).json([]);
            }

            const data = fs.readFileSync(assetsFile, 'utf8');
            const assets = JSON.parse(data);

            return res.status(200).json(assets);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch assets' });
        }
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
} 