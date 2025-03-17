import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Fields, Files } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Parse form data with screenshot files
        const form = new IncomingForm({
            uploadDir: path.join(process.cwd(), 'tmp'),
            keepExtensions: true,
            multiples: true,
        });

        // Ensure upload directory exists
        if (!fs.existsSync(form.uploadDir)) {
            fs.mkdirSync(form.uploadDir, { recursive: true });
        }

        const [fields, files] = await new Promise<[Fields, Files]>((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        // Get the uploaded screenshots
        const screenshots = Array.isArray(files.screenshots)
            ? files.screenshots
            : files.screenshots ? [files.screenshots] : [];

        if (screenshots.length === 0) {
            return res.status(400).json({ message: 'No screenshots uploaded' });
        }

        // Prepare screenshots as base64
        const screenshotBase64Array = screenshots.map(screenshot => {
            const buffer = fs.readFileSync(screenshot.filepath);
            return buffer.toString('base64');
        });

        // Create prompt for Claude
        const prompt = `
      I've recorded screenshots of my Phaser game. Please analyze them and provide feedback on:
      
      1. Game mechanics observed
      2. Player movement and controls
      3. Visual elements and graphics
      4. Any suggestions for improvements
      
      Here are the screenshots:
    `;

        // Prepare content array with text and images
        const content = [
            { type: 'text', text: prompt },
            ...screenshotBase64Array.map(base64 => ({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64
                }
            }))
        ];

        // Call Claude API with the screenshots
        const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-7-sonnet-20250219',
                max_tokens: 4000,
                messages: [
                    {
                        role: 'user',
                        content
                    }
                ]
            })
        });

        // Clean up temporary files
        screenshots.forEach(screenshot => {
            try {
                fs.unlinkSync(screenshot.filepath);
            } catch (e) {
                console.error('Error deleting temporary file:', e);
            }
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`API Response Error: ${apiResponse.status}`, errorText);
            throw new Error(`Claude API returned ${apiResponse.status}: ${errorText}`);
        }

        const responseData = await apiResponse.json();
        const analysisText = responseData.content[0].text;

        return res.status(200).json({
            message: analysisText
        });
    } catch (error) {
        console.error('Error analyzing screenshots:', error);
        return res.status(500).json({
            message: 'Error analyzing gameplay screenshots. Please try again.',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
    }
} 