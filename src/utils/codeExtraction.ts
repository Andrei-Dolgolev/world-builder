// utils/codeExtraction.ts - Enhanced version

/**
 * Extract all code blocks from a markdown string
 * This handles multiple code blocks and preserves language information
 */
export interface CodeBlock {
    code: string;
    language: string;
    index: number;
}

export function extractCodeBlocks(markdown: string): CodeBlock[] {
    if (!markdown) return [];

    const blocks: CodeBlock[] = [];

    // Match code blocks with or without language specification
    const regex = /```(?:([\w-]+)\n)?([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = regex.exec(markdown)) !== null) {
        const language = match[1] || 'javascript'; // Default to javascript if no language specified
        const code = match[2].trim();

        if (code) {
            blocks.push({
                code,
                language,
                index: index++
            });
        }
    }

    return blocks;
}

/**
 * Extract the first JavaScript/JS code block from a response
 * This is a more robust replacement for the existing regex approach
 */
export function extractJavaScriptCode(markdown: string): string | null {
    const blocks = extractCodeBlocks(markdown);

    // Find the first JavaScript/JS code block
    const jsBlock = blocks.find(block =>
        block.language === 'javascript' ||
        block.language === 'js'
    );

    return jsBlock ? jsBlock.code : null;
}

/**
 * Extracts all JavaScript code blocks and merges them
 * Improved version that detects if the code is already a complete game
 */
export function mergeJavaScriptBlocks(markdown: string): string {
    const blocks = extractCodeBlocks(markdown);

    // Filter for JavaScript blocks
    const jsBlocks = blocks.filter(block =>
        block.language === 'javascript' ||
        block.language === 'js'
    );

    if (jsBlocks.length === 0) return '';

    // For a single block, return it directly
    if (jsBlocks.length === 1) return jsBlocks[0].code;

    // Check if any block contains a complete Phaser game
    const completeGameBlock = jsBlocks.find(block => {
        const code = block.code;
        // Check for key signatures of a complete game
        return (
            code.includes('new Phaser.Game') &&
            (code.includes('class') || code.includes('function preload') || code.includes('function create'))
        );
    });

    // If we found a complete game, return just that block
    if (completeGameBlock) {
        return completeGameBlock.code;
    }

    // Try to intelligently reconstruct a complete game from multiple blocks
    let configBlock = jsBlocks.find(block => block.code.includes('const config') || block.code.includes('var config') || block.code.includes('let config'));
    let sceneBlock = jsBlocks.find(block => block.code.includes('class') && (block.code.includes('extends Phaser.Scene') || block.code.includes('preload()') || block.code.includes('create()')));
    let initBlock = jsBlocks.find(block => block.code.includes('new Phaser.Game'));

    if (configBlock && sceneBlock && initBlock) {
        // We have all pieces to reconstruct a game
        return `// Reconstructed from multiple code blocks
  ${configBlock.code}
  
  ${sceneBlock.code}
  
  ${initBlock.code}`;
    }

    // Fallback: just merge all blocks with clear separation
    return jsBlocks.map((block, index) =>
        `// ---------- Code Block ${index + 1} ----------\n${block.code}`
    ).join('\n\n');
}

/**
 * Ensures the code is a valid string and properly formatted
 * More robust version of the existing function
 */
export function ensureCodeString(input: any): string {
    // Handle null or undefined
    if (input == null) return '';

    // If it's an array, join with newlines
    if (Array.isArray(input)) {
        return input.map(item => String(item)).join('\n');
    }

    // If it's an object, stringify it
    if (typeof input === 'object') {
        try {
            return JSON.stringify(input, null, 2);
        } catch (e) {
            return String(input);
        }
    }

    // Ensure it's a string
    const textString = String(input);

    // Clean up common issues
    return textString
        .replace(/^\s+|\s+$/g, '')   // Trim whitespace
        .replace(/\\n/g, '\n')       // Replace literal \n with actual newlines
        .replace(/\\"/g, '"')        // Replace escaped quotes
        .replace(/\\t/g, '  ');      // Replace tabs with spaces
}