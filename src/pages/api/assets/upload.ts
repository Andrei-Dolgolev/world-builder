import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const config = {
    api: {
        bodyParser: false, // Disable the default body parser
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Create upload directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const form = new IncomingForm({
            uploadDir,
            keepExtensions: true,
            filename: (name, ext) => `${uuidv4()}${ext}`,
        });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to upload file' });
            }

            const file = files.file[0];
            const fileType = file.mimetype || 'application/octet-stream';
            const assetType = getAssetType(fileType);

            // Generate unique filename
            const originalName = file.originalFilename || 'unnamed-file';
            const fileName = `${uuidv4()}-${originalName}`;
            const filePath = path.join(uploadDir, fileName);

            // Rename the file to include the original name
            fs.renameSync(file.filepath, filePath);

            // Create relative path for client access
            const publicPath = `/uploads/${fileName}`;

            // Store asset metadata (in a real app, this would go in a database)
            const asset = {
                id: uuidv4(),
                name: originalName,
                type: assetType,
                path: publicPath,
                uploadedAt: new Date().toISOString(),
            };

            // Save to assets.json (temporary solution until database is implemented)
            const assetsFile = path.join(process.cwd(), 'public', 'assets.json');
            let assets = [];

            if (fs.existsSync(assetsFile)) {
                const data = fs.readFileSync(assetsFile, 'utf8');
                assets = JSON.parse(data);
            }

            assets.push(asset);
            fs.writeFileSync(assetsFile, JSON.stringify(assets, null, 2));

            return res.status(200).json(asset);
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to process upload' });
    }
}

function getAssetType(mimeType: string): 'image' | 'audio' | 'spritesheet' | 'other' {
    if (mimeType.startsWith('image/')) {
        return 'image';
    } else if (mimeType.startsWith('audio/')) {
        return 'audio';
    } else {
        return 'other';
    }
} 