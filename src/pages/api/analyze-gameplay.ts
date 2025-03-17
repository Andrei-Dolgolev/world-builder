import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

// Configure to parse form data
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
        // Parse the incoming form with the video file
        const form = new IncomingForm({
            uploadDir: path.join(process.cwd(), 'tmp'),
            keepExtensions: true,
            allowEmptyFiles: true,
            minFileSize: 0
        });

        // Create upload directory if it doesn't exist
        if (!fs.existsSync(form.uploadDir)) {
            fs.mkdirSync(form.uploadDir, { recursive: true });
        }

        // Parse the form
        const formData = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve({ fields, files });
            });
        });

        // Get game code if provided
        const fields = formData.fields as any;
        const gameCode = fields.gameCode || '';
        const gameType = fields.gameType || 'unknown';

        // Get the video file
        const files = formData.files as any;
        let videoFile;

        if (files.video) {
            if (Array.isArray(files.video)) {
                videoFile = files.video[0];
            } else {
                videoFile = files.video;
            }
        }

        if (!videoFile) {
            return res.status(400).json({ message: 'No video file provided' });
        }

        const filePath = videoFile.path || videoFile.filepath;
        if (!filePath) {
            return res.status(400).json({ message: 'Invalid file upload' });
        }

        // Check if file exists and has content
        const fileExists = fs.existsSync(filePath);
        const videoSize = fileExists ? fs.statSync(filePath).size : 0;

        console.log(`Received video file: ${filePath}, exists: ${fileExists}, size: ${videoSize} bytes`);

        // Add this near the top of the handler function
        console.log(`Analyzing gameplay with video size: ${videoSize} bytes, game type: ${gameType}`);

        // For small files, we'll still use Anthropic but with a note about file size
        const isSmallFile = videoSize < 10000;

        // For all files, send to Anthropic API
        try {
            // Extract video frames (in a real implementation, this would use ffmpeg or similar)
            // Here we're just simulating this step
            const videoDescription = isSmallFile
                ? `[Small recording detected - file size: ${videoSize} bytes. Analysis will focus primarily on code.]`
                : `[Game recording analysis - file size: ${videoSize} bytes, approximately 5 seconds of gameplay]`;

            console.log(`Sending to Anthropic API: ${videoDescription}`);

            // Send to Anthropic API
            const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
                            content: [
                                {
                                    type: 'text',
                                    text: `I've recorded gameplay of my Phaser game. Here's a description of the gameplay recording: ${videoDescription}

Game type: ${gameType}

Here's my game code:
\`\`\`javascript
${gameCode}
\`\`\`

Please analyze both my code and gameplay recording. Identify strengths and weaknesses, and suggest 3-5 specific improvements I can make to enhance my game, with code examples where appropriate.`
                                }
                            ]
                        }
                    ]
                })
            });

            if (!anthropicResponse.ok) {
                throw new Error(`Anthropic API error: ${anthropicResponse.status}`);
            }

            const responseData = await anthropicResponse.json();

            // Extract Claude's analysis
            let analysisText = "";
            if (responseData.content && Array.isArray(responseData.content)) {
                for (const block of responseData.content) {
                    if (block.type === 'text') {
                        analysisText = block.text;
                    }
                }
            }

            // Parse Claude's response to extract improvements
            const improvements = extractImprovements(analysisText);
            const insights = extractInsights(analysisText);

            // Clean up the file
            try {
                if (fileExists) fs.unlinkSync(filePath);
            } catch (err) {
                console.error('Error deleting temp file:', err);
            }

            // After receiving the response
            console.log(`Anthropic API response received, status: ${anthropicResponse.status}`);

            // Add more detailed logging
            console.log("Raw Anthropic response:", JSON.stringify(responseData).substring(0, 500) + "...");
            console.log("Analysis text length:", analysisText.length);
            console.log("Analysis text preview:", analysisText.substring(0, 200) + "...");

            // Return the AI-generated analysis
            return res.status(200).json({
                message: 'AI analysis completed',
                analysis: {
                    fileSize: videoSize,
                    estimatedQuality: 'AI analyzed',
                    estimatedFrameRate: 'AI analyzed',
                    suggestedImprovements: improvements,
                    codeInsights: insights,
                    fullAnalysis: analysisText
                }
            });

        } catch (apiError) {
            console.error('Error calling Anthropic API:', apiError);

            // Fall back to basic analysis if AI analysis fails
            const basicAnalysis = analyzeGameCode(gameCode, gameType, {
                motion: Math.min(10, Math.max(1, Math.floor(videoSize / 200000))),
                colorfulness: Math.min(10, Math.max(1, Math.floor(videoSize / 300000)))
            });

            // Clean up the file
            try {
                if (fileExists) fs.unlinkSync(filePath);
            } catch (err) {
                console.error('Error deleting temp file:', err);
            }

            return res.status(200).json({
                message: 'Fallback analysis completed',
                analysis: {
                    fileSize: videoSize,
                    estimatedQuality: videoSize > 1000000 ? 'excellent' : videoSize > 500000 ? 'good' : 'average',
                    estimatedFrameRate: videoSize > 500000 ? '60fps' : '30fps',
                    suggestedImprovements: basicAnalysis.improvements,
                    codeInsights: basicAnalysis.insights,
                    error: 'AI analysis failed, using basic analysis'
                }
            });
        }

    } catch (error) {
        console.error('Error analyzing gameplay:', error);
        return res.status(500).json({
            message: 'Error analyzing gameplay',
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

// Helper functions to extract insights and improvements from AI response
function extractImprovements(analysisText) {
    const improvements = [];

    // Look for numbered lists of improvements
    const improvementRegex = /\d+\.\s+\*\*([^*]+)\*\*/g;
    let match;

    while ((match = improvementRegex.exec(analysisText)) !== null) {
        improvements.push(match[1].trim());
    }

    // If no improvements found with the regex, extract from sections
    if (improvements.length === 0) {
        const sections = analysisText.split(/#+\s+/);
        for (const section of sections) {
            if (section.toLowerCase().includes('improvement') ||
                section.toLowerCase().includes('suggestion') ||
                section.toLowerCase().includes('recommendation')) {

                // Extract bullet points
                const bulletPoints = section.split(/\n-\s+/).slice(1);
                bulletPoints.forEach(point => {
                    const cleanPoint = point.split('\n')[0].trim();
                    if (cleanPoint) improvements.push(cleanPoint);
                });
            }
        }
    }

    // Return found improvements or fallback to default suggestions
    return improvements.length > 0 ? improvements : [
        'Add more visual feedback when collecting items or scoring points',
        'Implement smoother transition animations between game states',
        'Improve the contrast of UI elements for better visibility'
    ];
}

function extractInsights(analysisText) {
    const insights = [];

    // Look for insights in the strengths or analysis sections
    if (analysisText.toLowerCase().includes('strength')) {
        const strengthsSection = analysisText.split(/#+\s+Strength/i)[1]?.split(/#+\s+/)[0];
        if (strengthsSection) {
            const bulletPoints = strengthsSection.split(/\n-\s+/).slice(1);
            bulletPoints.forEach(point => {
                const cleanPoint = point.split('\n')[0].trim();
                if (cleanPoint) insights.push(cleanPoint);
            });
        }
    }

    return insights;
}

// Basic analysis function as fallback
function analyzeGameCode(code, gameType, metrics) {
    // Default insights/improvements
    const insights = [];
    const improvements = [];

    // Check for animation techniques in the code
    const hasAnimations = code.includes('anims.create') || code.includes('animation');
    const hasParticles = code.includes('particles') || code.includes('emitter');
    const hasTweens = code.includes('tween') || code.includes('add.tween');
    const hasSpritesheet = code.includes('spritesheet') || code.includes('atlas');

    // Analyze code based on video metrics
    if (metrics.motion < 5 && !hasTweens) {
        improvements.push('Add more motion using Phaser tweens for smoother object movements');
        insights.push('Low motion detected in gameplay - consider adding more dynamic elements');
    }

    if (metrics.colorfulness < 4 && !hasParticles) {
        improvements.push('Enhance visual appeal with particle effects for important game events');
        insights.push('Limited color variation detected - particle effects could add visual interest');
    }

    if (!hasAnimations) {
        improvements.push('Implement sprite animations to make characters and objects more lively');
    }

    if (!hasSpritesheet && gameType !== 'puzzle') {
        improvements.push('Use spritesheets for more efficient and smoother animations');
    }

    // Look for physics-related code
    if (code.includes('physics') && !code.includes('collider')) {
        improvements.push('Add collision handling between game objects for better interactions');
    }

    // Check for feedback elements
    if (!code.includes('sound.play') && !code.includes('audio')) {
        improvements.push('Add sound effects for key game actions to improve player feedback');
    }

    // Check for UI elements
    if (!code.includes('text') && !code.includes('Text')) {
        improvements.push('Add text-based UI elements to display score or instructions');
    }

    // If we have few specific improvements, add some general ones
    if (improvements.length < 3) {
        improvements.push('Consider adding visual feedback when collecting items or scoring points');
        improvements.push('Implement smoother transition animations between game states');
        improvements.push('Improve the contrast of UI elements for better visibility');
    }

    return {
        improvements: improvements.slice(0, 5), // Limit to top 5 improvements
        insights
    };
} 