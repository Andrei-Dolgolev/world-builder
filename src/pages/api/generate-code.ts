import type { NextApiRequest, NextApiResponse } from 'next';
import { PHASER_SYSTEM_PROMPT } from '../../utils/prompts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { prompt, currentCode, conversation } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // Define fallback mock responses
    const mockMessage = "I've created a simple bouncing ball for your Phaser game.";
    const mockCode = `
// Game configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 300 },
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

// Create a new Phaser Game instance
const game = new Phaser.Game(config);

// Game variables
let ball;

// Preload assets
function preload() {
  // No assets to preload
}

// Set up the game
function create() {
  // Create a ball
  ball = this.add.circle(400, 300, 20, 0xff0000);
  
  // Enable physics on the ball
  this.physics.add.existing(ball);
  
  // Make the ball bounce
  ball.body.setBounce(1, 1);
  ball.body.setCollideWorldBounds(true);
  
  // Set initial velocity
  ball.body.setVelocity(200, 200);
}

// Game loop
function update() {
  // No additional update logic needed
}
`;

    // Check if we should use mock responses
    const useMockResponse = !process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'your_claude_api_key' ||
      process.env.USE_MOCK_RESPONSES === 'true';

    // Conditionally use API or fallback to mock
    if (useMockResponse) {
      console.log("Using mock response (no API key configured)");
      return res.status(200).json({
        message: mockMessage,
        code: mockCode,
        thinking: "This is mock thinking content."
      });
    }

    try {
      console.log("Using direct fetch to Anthropic API with extended thinking");

      // Create the enhanced system prompt with context
      const enhancedSystemPrompt = `${PHASER_SYSTEM_PROMPT}

CURRENT CODE:
\`\`\`javascript
${currentCode || '// No code provided'}
\`\`\`

Remember to provide a complete version of the code that incorporates your changes.`;

      // Format conversation for the API
      const apiMessages = [];

      // Add conversation history if available
      if (conversation && Array.isArray(conversation)) {
        // Convert our internal message format to Anthropic's format
        conversation.forEach(msg => {
          if (msg.sender === 'user' || msg.sender === 'ai') {
            apiMessages.push({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.sender === 'assistant' && msg.thinking
                ? [
                  { type: 'thinking', thinking: msg.thinking },
                  { type: 'text', text: msg.text }
                ]
                : msg.text
            });
          }
        });
      }

      // Add the current prompt
      apiMessages.push({ role: 'user', content: prompt });

      // Prepare request payload with thinking enabled
      const requestBody = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        system: enhancedSystemPrompt,
        messages: apiMessages,
        thinking: {
          type: "enabled",
          budget_tokens: 2000
        }
      };

      console.log("Sending direct API request to Anthropic with extended thinking");

      // Make direct API call
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`API returned ${apiResponse.status}: ${errorText}`);
      }

      const responseData = await apiResponse.json();
      console.log("API response received:",
        responseData.content ? "Content found" : "No content");

      // Extract the thinking content if available
      let thinking = "";
      let responseText = "";

      if (responseData.content && Array.isArray(responseData.content)) {
        // Process the content blocks
        for (const block of responseData.content) {
          if (block.type === 'thinking') {
            thinking = block.thinking;
          } else if (block.type === 'redacted_thinking') {
            thinking = "[Redacted thinking content]";
          } else if (block.type === 'text') {
            responseText = block.text;
          }
        }
      }

      if (!responseText) {
        throw new Error("Invalid response format from API");
      }

      // Basic extraction of code blocks
      const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)```/;
      const match = responseText.match(codeBlockRegex);

      console.log("Response text (first 500 chars):", responseText.substring(0, 500));

      let extractedCode = match ? match[1].trim() : null;

      // NEW: Never return null code - use existing code or fallback
      if (!extractedCode || extractedCode === 'null') {
        console.warn("No code found in AI response, using fallback");
        // If we have current code, use that instead of returning null
        extractedCode = currentCode || mockCode;
      }

      // Debug logging
      console.log("Extracted code type:", typeof extractedCode);
      console.log("Extracted code length:", extractedCode ? String(extractedCode).length : 0);

      // After extracting the code from the AI response:
      if (extractedCode) {
        // Ensure code is a proper string, not an object
        if (typeof extractedCode === 'object') {
          try {
            // Try to convert object to formatted JSON string
            extractedCode = JSON.stringify(extractedCode, null, 2);
            console.warn('Converting object code to JSON string');
          } catch (err) {
            console.error('Error stringifying code object:', err);
            extractedCode = String(extractedCode); // Fallback to basic toString
          }
        }
      }

      // Also ensure the entire code response is processed as a string
      return res.status(200).json({
        message: responseText,
        code: typeof extractedCode === 'string' ? extractedCode : String(extractedCode),
        thinking: thinking
      });
    } catch (apiError: unknown) {
      // Type guard for apiError
      const error = apiError as Error;

      console.error("DETAILED API ERROR:", {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200) // First 200 chars of stack trace
      });

      // Fallback response
      return res.status(200).json({
        message: `${mockMessage}\n\n(Note: This is a fallback response due to API issues. Error: ${error.message})`,
        code: mockCode,
        thinking: "Error occurred during thinking process."
      });
    }
  } catch (error) {
    console.error('Error in API route:', error);
    return res.status(500).json({
      message: 'Error processing your request. Please try again.',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

class MetricsRecorder {
  constructor(game) {
    this.game = game;
    this.metrics = {
      playtime: 0,
      jumps: 0,
      deaths: 0,
      enemiesDefeated: 0,
      scoreProgression: [],
      inputFrequency: { left: 0, right: 0, up: 0, down: 0 }
    };

    this.setupListeners();
    this.startTimer();
  }

  setupListeners() {
    // Track player actions
    this.game.input.keyboard.on('keydown', (event) => {
      // Record key presses
      if (event.key === 'ArrowUp') {
        this.metrics.jumps++;
        this.metrics.inputFrequency.up++;
      }
      // etc.
    });
  }

  // Additional methods for tracking game-specific events
} 