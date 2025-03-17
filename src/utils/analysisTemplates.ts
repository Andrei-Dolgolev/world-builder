// Analysis templates for different game types

export type GameType = 'platformer' | 'shooter' | 'puzzle' | 'default';

export interface AnalysisTemplate {
    title: string;
    content: string;
}

// Detect the game type based on code patterns
export const detectGameType = (code: string): GameType => {
    // Check for platformer patterns
    if (
        code.includes('platformer') ||
        (code.includes('jump') &&
            (code.includes('gravity') || code.includes('platform')))
    ) {
        return 'platformer';
    }

    // Check for shooter patterns
    if (
        code.includes('shooter') ||
        (code.includes('bullet') &&
            (code.includes('enemy') || code.includes('shoot')))
    ) {
        return 'shooter';
    }

    // Check for puzzle patterns
    if (
        code.includes('puzzle') ||
        (code.includes('match') &&
            (code.includes('tile') || code.includes('grid')))
    ) {
        return 'puzzle';
    }

    // Default to platformer for the base template
    return 'default';
};

// Analysis templates for different game types
export const analysisTemplates: Record<GameType, AnalysisTemplate> = {
    platformer: {
        title: 'Platform Game Analysis',
        content: `# Platform Game Analysis

## Game Mechanics Observed
- Platform jumping mechanics with gravity physics
- Coin collection system with score tracking
- Lives system with limited attempts
- Character movement (left/right)

## Player Controls
- Character responds well to movement inputs
- Jump height is appropriate for platform spacing
- Character movement speed is balanced

## Visual Elements
- Game world with platforms and obstacles
- Collectible coins are clearly visible
- Score and lives display in the HUD

## Suggestions for Improvements
1. **Game Elements to Add:**
   - Enemy characters that patrol platforms
   - Power-ups with temporary abilities (high jump, speed boost)
   - Moving platforms for challenging jumps
   - Checkpoint system for longer levels

2. **Visual Enhancements:**
   - Particle effects when collecting coins
   - Jump and landing animations for the character
   - Visual feedback when gaining/losing lives
   - Background parallax effect for depth

3. **Gameplay Progression:**
   - Multiple levels with increasing difficulty
   - End-of-level boss encounters
   - Unlock new abilities as player progresses
   - Save game progress between sessions

Would you like me to implement any of these improvements to your platform game?`
    },

    shooter: {
        title: 'Shooter Game Analysis',
        content: `# Shooter Game Analysis

## Game Mechanics Observed
- Player-controlled spaceship/character
- Shooting projectiles at enemies
- Enemy waves and movement patterns
- Health/lives system

## Player Controls
- Ship/character moves responsively
- Firing mechanism works consistently
- Collision detection is accurate

## Visual Elements
- Player and enemy sprites with good contrast
- Projectile effects are visible
- Score and health indicators in the UI

## Suggestions for Improvements
1. **Combat Enhancements:**
   - Different weapon types (spread shot, laser, missiles)
   - Enemy variety with different attack patterns
   - Shield/defensive abilities for the player
   - Destructible environment elements

2. **Visual Feedback:**
   - Explosion animations for defeated enemies
   - Screen shake for impactful events
   - Hit indicators when taking damage
   - Power-up visual effects

3. **Progression Systems:**
   - Weapon upgrade system
   - Level progression with boss fights
   - Score multipliers for skilled play
   - High score leaderboard

Would you like me to implement any of these improvements to your shooter game?`
    },

    puzzle: {
        title: 'Puzzle Game Analysis',
        content: `# Puzzle Game Analysis

## Game Mechanics Observed
- Matching or connecting elements
- Grid-based gameplay
- Score system based on successful matches
- Time or move limitations

## Player Interaction
- Element selection is intuitive
- Match recognition works correctly
- Chain reactions and combos are possible

## Visual Design
- Game elements are visually distinct
- Matching animations provide satisfaction
- Score and progress indicators are clear

## Suggestions for Improvements
1. **Gameplay Mechanics:**
   - Special pieces that clear rows/columns
   - Obstacle tiles that block matches
   - Goal-based levels (clear specific tiles, reach score)
   - Multiple game modes (timed, zen, challenge)

2. **Visual Enhancements:**
   - Particles and effects for matches
   - Animated backgrounds that respond to gameplay
   - Satisfying animations for special moves
   - Thematic visual styles for different levels

3. **Progression Features:**
   - Level progression with increasing challenge
   - Star rating system for completionist appeal
   - Daily challenges with rewards
   - Unlock new game elements as player advances

Would you like me to implement any of these improvements to your puzzle game?`
    },

    default: {
        title: 'Game Analysis',
        content: `# Game Analysis

## Game Mechanics Observed
- Core gameplay loop established
- Basic control scheme implemented
- Scoring/progress tracking system
- Win/loss conditions defined

## Player Experience
- Controls respond well to input
- Game objectives are clear
- Difficulty level is appropriate
- Basic gameplay elements function correctly

## Visual Implementation
- Game elements are visually distinct
- UI displays necessary information
- Animation fundamentals are in place
- Visual hierarchy guides player attention

## Suggestions for Improvements
1. **Core Gameplay Enhancements:**
   - Additional gameplay mechanics for variety
   - More interactive elements in the game world
   - Challenge progression throughout gameplay
   - Reward systems for player accomplishment

2. **Visual and Audio Feedback:**
   - Improved visual feedback for player actions
   - Animations for key game events
   - Sound effects for interactions
   - Visual polish for game elements

3. **Player Progression:**
   - Level or stage progression system
   - Skill development or upgrade path
   - Goal-based challenges to complete
   - Save system for longer games

Would you like me to implement any of these improvements to your game?`
    }
};

// Get the appropriate analysis based on game type
export const getGameAnalysis = (code: string): AnalysisTemplate => {
    const gameType = detectGameType(code);
    return analysisTemplates[gameType];
}; 