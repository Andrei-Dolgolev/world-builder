import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;

    if (req.method === 'GET') {
        try {
            const assetsFile = path.join(process.cwd(), 'public', 'assets.json');
            if (!fs.existsSync(assetsFile)) {
                return res.status(404).json({ error: 'Asset not found' });
            }

            const data = fs.readFileSync(assetsFile, 'utf8');
            const assets = JSON.parse(data);

            const asset = assets.find((a: any) => a.id === id);
            if (!asset) {
                return res.status(404).json({ error: 'Asset not found' });
            }

            return res.status(200).json(asset);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch asset' });
        }
    } else if (req.method === 'DELETE') {
        try {
            const assetsFile = path.join(process.cwd(), 'public', 'assets.json');
            if (!fs.existsSync(assetsFile)) {
                return res.status(404).json({ error: 'Asset not found' });
            }

            const data = fs.readFileSync(assetsFile, 'utf8');
            let assets = JSON.parse(data);

            const asset = assets.find((a: any) => a.id === id);
            if (!asset) {
                return res.status(404).json({ error: 'Asset not found' });
            }

            // Remove file from filesystem
            const filePath = path.join(process.cwd(), 'public', asset.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Remove from assets list
            assets = assets.filter((a: any) => a.id !== id);
            fs.writeFileSync(assetsFile, JSON.stringify(assets, null, 2));

            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to delete asset' });
        }
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
} 