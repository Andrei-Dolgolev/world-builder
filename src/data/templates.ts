export interface GameTemplate {
    id: string;
    name: string;
    description: string;
    category: 'phaser' | 'javascript' | 'typescript';
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    imageUrl?: string;
}

export const templates: GameTemplate[] = [
    {
        id: 'phaser-blank',
        name: 'Phaser Basic Game',
        description: 'A simple Phaser game template with the essentials to get you started.',
        category: 'phaser',
        difficulty: 'beginner',
        imageUrl: '/templates/phaser-basic.png'
    },
    {
        id: 'phaser-platformer',
        name: 'Platformer Game',
        description: 'A platform game template with player movement, platforms, and collectibles.',
        category: 'phaser',
        difficulty: 'intermediate',
        imageUrl: '/templates/phaser-platformer.png'
    },
    {
        id: 'phaser-space-shooter',
        name: 'Space Shooter',
        description: 'A space shooter game with enemies, bullets, and power-ups.',
        category: 'phaser',
        difficulty: 'intermediate',
        imageUrl: '/templates/phaser-space-shooter.png'
    },
    {
        id: 'phaser-snake',
        name: 'Snake Game',
        description: 'The classic Snake game with score tracking and increasing difficulty.',
        category: 'phaser',
        difficulty: 'beginner',
        imageUrl: '/templates/phaser-snake.png'
    },
    {
        id: 'custom',
        name: 'Custom Game',
        description: 'Start with a blank canvas and build your game from scratch.',
        category: 'javascript',
        difficulty: 'advanced',
        imageUrl: '/templates/custom.png'
    }
]; 