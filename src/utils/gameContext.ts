/**
 * Game Context for AI
 * 
 * This file provides context to the AI about how games are executed in our system.
 */

export const gameRuntimeContext = `
# Game Runtime Environment

Your code will run in a web browser with the following specifics:

1. Phaser 3.55.2 is pre-loaded (via CDN)
2. Game canvas size defaults to 800x600 
3. Your game code runs in an iframe with allow-scripts sandbox

## Phaser Configuration Requirements
- You must initialize Phaser with a scene (or scenes)
- Physics, if used, should be configured in the Phaser config
- Typical configuration:
\`\`\`javascript
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
  scene: [YourGameScene]
};

const game = new Phaser.Game(config);
\`\`\`

## Asset Loading
- External assets can be loaded from:
  - https://labs.phaser.io/assets/
  - Other public URLs with CORS enabled

## Game Structure Recommendations
- Create a scene class for your game logic
- Use class methods for different game functionality
- Implement the standard Phaser lifecycle methods (preload, create, update)
`;

/**
 * Returns a combination of the runtime context and any additional game-specific context
 */
export const getGameContext = (specificContext?: string): string => {
    return `${gameRuntimeContext}
  
${specificContext || ''}`;
}; 