import type { NextApiRequest, NextApiResponse } from 'next';
import { PHASER_SYSTEM_PROMPT, GAME_DESIGN_DOCUMENT_PROMPT, COMBINED_GAME_DEV_PROMPT } from '../../utils/prompts';
import { mergeJavaScriptBlocks } from '../../utils/codeExtraction';

// Enhanced Phaser system prompt for better game mechanics
const ENHANCED_PHASER_SYSTEM_PROMPT = `${PHASER_SYSTEM_PROMPT}

GAME FUNCTIONALITY REQUIREMENTS:
1. Character Movement:
   - Always implement proper keyboard movement controls (LEFT, RIGHT for horizontal movement, UP or SPACEBAR for jump)
   - Use Phaser's built-in keyboard handling (this.input.keyboard.createCursorKeys())
   - Character movement should be responsive and smooth
   - Apply appropriate acceleration and deceleration
   - Avoid fixed velocity assignments that may cause jerky movement

2. Game Restart:
   - Always implement a restart mechanism that fully resets the game state
   - When restarting, destroy all existing game objects before creating new ones
   - Reset player position, score, and any game variables to initial values
   - Ensure the physics bodies are properly re-created during restart
   - Add a restart key (usually 'R') or use scene restart methods

3. Game Structure:
   - Organize code into clear preload(), create(), and update() methods
   - Use separate functions for different functionality (movement, collisions, etc.)
   - Initialize variables properly at the start of the scene
   - Implement proper event listeners and cleanly remove them when needed`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const {
      prompt,
      currentCode,
      conversation,
      mode = 'code', // Possible values: 'code', 'gdd', 'hybrid'
      gameIdea,
      gameName,
      genre,
      targetAudience
    } = req.body;

    // Validate required inputs based on mode
    if (mode === 'code' && !prompt) {
      return res.status(400).json({ message: 'Prompt is required for code generation mode' });
    }

    if (mode === 'gdd' && !gameIdea) {
      return res.status(400).json({ message: 'Game idea is required for GDD mode' });
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
let cursors;
let restartKey;

// Preload assets
function preload() {
  // No assets to preload
  this.load.image('ball', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC');
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
  
  // Setup keyboard controls
  cursors = this.input.keyboard.createCursorKeys();
  
  // Setup restart key
  restartKey = this.input.keyboard.addKey('R');
  restartKey.on('down', function() {
    this.scene.restart();
  }, this);
}

// Game loop
function update() {
  // Control the ball with cursors
  if (cursors.left.isDown) {
    ball.body.setVelocityX(-150);
  } else if (cursors.right.isDown) {
    ball.body.setVelocityX(150);
  }
  
  if (cursors.up.isDown) {
    ball.body.setVelocityY(-150);
  } else if (cursors.down.isDown) {
    ball.body.setVelocityY(150);
  }
}
`;

    const mockGDD = `# ${gameName || 'New Game'} - Game Design Document
    
## 1. Game Overview
- **Concept:** A mock game design document for testing
- **Genre:** ${genre || 'Platformer'}
- **Target Audience:** ${targetAudience || 'Casual gamers'}
- **Platform:** Web browser via Phaser.js
- **Game Flow:** The player advances through levels, collecting items and avoiding obstacles

## 2. Gameplay
- **Core Mechanics:** Platform jumping, item collection, enemy avoidance
- **Player Controls:** Arrow keys for movement, spacebar for jump
- **Objectives:** Collect all items and reach the end of each level
- **Progression:** Increasing difficulty with more complex platforms and enemy patterns

## 3. Technical Specifications
- **Phaser Version:** Phaser 3.55 or newer
- **Key Phaser Components:** Arcade physics, sprite animation, tilemaps
- **Physics Requirements:** Arcade physics for platform collision and gravity
- **Asset Requirements:** Character sprites, platforms, collectibles, background elements

## 4. Implementation Roadmap
- **Phase 1:** Core movement, platforms, and basic level design
- **Phase 2:** Collectibles, scoring, and enemy implementation
- **Phase 3:** Multiple levels, sound effects, and game polish

## 5. Code Architecture
- **Main Game Structure:** Single file with separate scenes for menus and gameplay
- **Key Classes/Objects:** PlayScene, Player, Collectible, Enemy
- **Scene Management:** Simple scene transition from menu to gameplay`;

    // Check if we should use mock responses
    const useMockResponse = !process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_API_KEY === 'your_claude_api_key' ||
      process.env.USE_MOCK_RESPONSES === 'true';

    // Conditionally use API or fallback to mock
    if (useMockResponse) {
      console.log("Using mock response (no API key configured)");

      // Return different mock responses based on mode
      if (mode === 'gdd') {
        return res.status(200).json({
          message: mockGDD,
          gdd: mockGDD,
          thinking: "This is mock thinking content for GDD generation."
        });
      } else {
        return res.status(200).json({
          message: mockMessage,
          code: mockCode,
          thinking: "This is mock thinking content."
        });
      }
    }

    try {
      console.log(`Using direct fetch to Anthropic API with mode: ${mode}`);

      // Select the appropriate system prompt based on mode
      let systemPrompt = '';
      let userPrompt = '';

      switch (mode) {
        case 'gdd':
          systemPrompt = GAME_DESIGN_DOCUMENT_PROMPT;
          userPrompt = `I want to create a game called "${gameName || 'My Game'}" 
          with genre "${genre || ''}" for "${targetAudience || 'general audience'}".
          
          Game idea: ${gameIdea}
          
          Please create a comprehensive Game Design Document (GDD) for this idea.`;
          break;

        case 'hybrid':
          systemPrompt = COMBINED_GAME_DEV_PROMPT;
          userPrompt = prompt || gameIdea;

          // Add current code context if available
          if (currentCode) {
            systemPrompt += `\n\nCURRENT CODE:\n\`\`\`javascript\n${currentCode}\n\`\`\``;
          }
          break;

        case 'code':
        default:
          // Use the enhanced prompt for better game mechanics
          systemPrompt = `${ENHANCED_PHASER_SYSTEM_PROMPT}\n\nCURRENT CODE:\n\`\`\`javascript\n${currentCode || '// No code provided'}\`\`\`\n\nRemember to provide a complete version of the code that incorporates your changes and can run as a standalone script.`;
          userPrompt = prompt;
          break;
      }

      // Simplified conversation handling for API
      const apiMessages = [];

      // Add conversation history if available
      if (conversation && Array.isArray(conversation)) {
        // Convert our internal message format to Anthropic's format
        conversation.forEach(msg => {
          // Check for valid roles and content
          const role = (msg.sender === 'assistant' || msg.role === 'assistant') ? 'assistant' : 'user';
          const content = typeof msg.text === 'string' ? msg.text :
            (typeof msg.content === 'string' ? msg.content : '');

          // Only add message if it has content
          if (content.trim()) {
            apiMessages.push({ role, content });
          }
        });
      }

      // Add the current prompt
      apiMessages.push({ role: 'user', content: userPrompt });

      console.log(`Sending conversation with ${apiMessages.length} messages`);

      // Updated request structure using reasoning instead of thinking
      const requestBody = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 40000,
        system: systemPrompt,
        messages: apiMessages,
        thinking: {
          type: "enabled",
          budget_tokens: 20000
        }
      };

      console.log("Sending API request with reasoning enabled");

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

      // Improved response extraction with better error handling
      let thinking = "";
      let responseText = "";

      if (responseData.content && Array.isArray(responseData.content)) {
        // Process the content blocks
        for (const block of responseData.content) {
          if (block.type === 'thinking' && block.thinking) {
            // Handle thinking block
            thinking = typeof block.thinking === 'string'
              ? block.thinking
              : JSON.stringify(block.thinking);
          } else if (block.type === 'reasoning' && block.reasoning) {
            // Handle reasoning block (newer API versions)
            thinking = typeof block.reasoning === 'string'
              ? block.reasoning
              : JSON.stringify(block.reasoning);
          } else if (block.type === 'redacted_thinking') {
            thinking = "[Redacted thinking content]";
          } else if (block.type === 'text') {
            responseText = block.text || '';
          }
        }
      } else if (responseData.text) {
        // Fallback for simple text response
        responseText = responseData.text;
      }

      if (!responseText) {
        throw new Error("Invalid response format from API");
      }

      // Prepare the response based on the mode
      if (mode === 'gdd') {
        return res.status(200).json({
          message: responseText,
          gdd: responseText,
          thinking: thinking || "AI reasoning process unavailable for this response."
        });
      } else {
        // Extract code blocks for code or hybrid modes
        let extractedCode = mergeJavaScriptBlocks(responseText);

        // Ensure extractedCode is never null
        if (!extractedCode) {
          console.warn("No code found in AI response, using fallback");
          extractedCode = currentCode || mockCode;
        }

        // Ensure code is properly formatted
        const finalCode = typeof extractedCode === 'string'
          ? extractedCode
          : String(extractedCode);

        return res.status(200).json({
          message: responseText,
          code: finalCode,
          thinking: thinking || "AI reasoning process unavailable for this response."
        });
      }
    } catch (apiError: unknown) {
      // Type guard for apiError
      const error = apiError as Error;

      console.error("DETAILED API ERROR:", {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200) // First 200 chars of stack trace
      });

      // Fallback response based on mode
      if (mode === 'gdd') {
        return res.status(200).json({
          message: `${mockGDD}\n\n(Note: This is a fallback response due to API issues. Error: ${error.message})`,
          gdd: mockGDD,
          thinking: "Error occurred during reasoning process."
        });
      } else {
        return res.status(200).json({
          message: `${mockMessage}\n\n(Note: This is a fallback response due to API issues. Error: ${error.message})`,
          code: mockCode,
          thinking: "Error occurred during reasoning process."
        });
      }
    }
  } catch (error) {
    console.error('Error in API route:', error);
    return res.status(500).json({
      message: 'Error processing your request. Please try again.',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}