// basePhaser.ts
// This file should only export template strings, not actually use Phaser

export const basePhaserTemplate = `// Basic Phaser Game Template with proper update loop
const gameConfig = {
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

// Initialize the game with the configuration
const game = new Phaser.Game(gameConfig);

// Game variables
let player;
let platforms;
let cursors;
let score = 0;
let scoreText;

// Preload game assets
function preload() {
  // Load assets (images, sprites, sounds, etc.)
  this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
  this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
  this.load.spritesheet('dude', 'https://labs.phaser.io/assets/sprites/dude.png', { 
    frameWidth: 32, 
    frameHeight: 48 
  });
}

// Set up the game
function create() {
  // Add background
  this.add.image(400, 300, 'sky');
  
  // Create platforms group (static physics)
  platforms = this.physics.add.staticGroup();
  
  // Create ground platforms
  platforms.create(400, 568, 'ground').setScale(2).refreshBody();
  platforms.create(600, 400, 'ground');
  platforms.create(50, 250, 'ground');
  platforms.create(750, 220, 'ground');
  
  // Create player
  player = this.physics.add.sprite(100, 450, 'dude');
  player.setBounce(0.2);
  player.setCollideWorldBounds(true);
  
  // Player animations
  this.anims.create({
    key: 'left',
    frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
  });
  
  this.anims.create({
    key: 'turn',
    frames: [{ key: 'dude', frame: 4 }],
    frameRate: 20
  });
  
  this.anims.create({
    key: 'right',
    frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
    frameRate: 10,
    repeat: -1
  });
  
  // Set up collisions
  this.physics.add.collider(player, platforms);
  
  // Set up keyboard input
  cursors = this.input.keyboard.createCursorKeys();
  
  // Add score text
  scoreText = this.add.text(16, 16, 'Score: 0', { 
    fontSize: '32px', 
    fill: '#fff' 
  });
}

// Game loop - runs continuously
function update() {
  try {
    // Player movement logic
    if (cursors.left.isDown) {
      player.setVelocityX(-160);
      player.anims.play('left', true);
    } else if (cursors.right.isDown) {
      player.setVelocityX(160);
      player.anims.play('right', true);
    } else {
      player.setVelocityX(0);
      player.anims.play('turn');
    }
    
    // Player jumping - only if touching the ground
    if (cursors.up.isDown && player.body.touching.down) {
      player.setVelocityY(-330);
    }
    
    // Additional game logic can be added here
  } catch (error) {
    // Error handling to prevent game crashes
    console.error("Error in update loop:", error);
  }
}`;

// Secondary template for class-based scene structure
export const classBasedPhaserTemplate = `// Class-based Phaser Game with Scene classes

class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  preload() {
    // Load assets here
    this.load.image('sky', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
    this.load.spritesheet('dude', 'https://labs.phaser.io/assets/sprites/dude.png', { 
      frameWidth: 32, 
      frameHeight: 48 
    });
  }

  create() {
    // Create game elements here
    this.add.image(400, 300, 'sky');
    
    // Add text
    this.add.text(400, 300, 'Hello World', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
  }

  update() {
    // Game loop code here
  }
}

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
  scene: [MainScene]
};

const game = new Phaser.Game(config);`; 