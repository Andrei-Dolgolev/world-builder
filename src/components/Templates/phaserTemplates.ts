export const templates = {
    'phaser-blank': `
// Initialize Phaser
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

// Preload assets
function preload() {
  // This function will be called before the game starts
  // Here you can load images, sounds, etc.
}

// Set up the game
function create() {
  // This function will be called once, after preload
  // Create your game objects here
  this.add.text(400, 300, 'Hello Phaser!', { 
    fontSize: '32px', 
    fill: '#fff' 
  }).setOrigin(0.5);
}

// Game loop
function update() {
  // This function is called up to 60 times per second
  // Add your game logic here
}
`,
    'phaser-platformer': `
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
let player;
let platforms;
let cursors;

// Preload assets
function preload() {
  // Use colored rectangles for this simple example
  this.load.image('ground', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
}

// Set up the game
function create() {
  // Create platforms group
  platforms = this.physics.add.staticGroup();
  
  // Create the ground
  platforms.create(400, 568, 'ground').setScale(800, 32).refreshBody();
  
  // Create some platforms
  platforms.create(600, 400, 'ground').setScale(100, 20).refreshBody();
  platforms.create(50, 250, 'ground').setScale(100, 20).refreshBody();
  platforms.create(750, 220, 'ground').setScale(100, 20).refreshBody();
  
  // Create player
  player = this.physics.add.sprite(100, 450, 'player');
  player.setBounce(0.2);
  player.setCollideWorldBounds(true);
  player.setTint(0x00ff00); // Green color
  
  // Player physics
  this.physics.add.collider(player, platforms);
  
  // Input
  cursors = this.input.keyboard.createCursorKeys();
}

// Game loop
function update() {
  // Player movement
  if (cursors.left.isDown) {
    player.setVelocityX(-160);
  } else if (cursors.right.isDown) {
    player.setVelocityX(160);
  } else {
    player.setVelocityX(0);
  }
  
  // Jumping
  if (cursors.up.isDown && player.body.touching.down) {
    player.setVelocityY(-330);
  }
}
`,
};

export function getTemplateCode(templateId: string): string {
    return templates[templateId] || templates['phaser-blank'];
} 