// Define the Phaser game template as a raw string to prevent evaluation
export const phaserBasicTemplate = String.raw`
// Define the scene first
class SnakeScene extends Phaser.Scene {
  constructor() {
    super('SnakeScene');
    this.snake = [];
    this.food = null;
    this.direction = 'right';
    this.nextDirection = 'right';
    this.gridSize = 16;
    this.speed = 100; // ms between moves
    this.moveTime = 0;
    this.score = 0;
    this.scoreText = null;
    this.gameOverText = null;
    this.isGameOver = false;
  }

  preload() {
    // Load assets
    this.load.image('food', 'https://labs.phaser.io/assets/sprites/apple.png');
    this.load.image('body', 'https://labs.phaser.io/assets/sprites/orb-blue.png');
    this.load.image('head', 'https://labs.phaser.io/assets/sprites/orb-red.png');
  }

  create() {
    // Create snake
    this.createSnake();

    // Create food
    this.food = this.physics.add.image(0, 0, 'food');
    this.food.setOrigin(0.5);
    this.food.setScale(0.5);
    this.repositionFood();

    // Set up controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Add score text
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '32px',
      fill: '#fff'
    });

    // Game over text (hidden initially)
    this.gameOverText = this.add.text(
      this.sys.game.config.width / 2,
      this.sys.game.config.height / 2,
      'GAME OVER\\nPress SPACE to restart',
      { fontSize: '48px', fill: '#ff0000', align: 'center' }
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setVisible(false);

    // Restart key
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.isGameOver) {
        this.scene.restart();
      }
    });
  }

  update(time) {
    if (this.isGameOver) {
      return;
    }

    // Handle input
    this.handleInput();

    // Move snake at regular intervals
    if (time >= this.moveTime) {
      this.moveSnake();
      this.moveTime = time + this.speed;
    }

    // Check collisions
    this.checkCollision();

    // Check food collection
    this.checkFood();
  }

  // Game logic methods
  createSnake() {
    // Start with 3 segments
    for (let i = 0; i < 3; i++) {
      const segment = this.physics.add.image(
        (2 - i) * this.gridSize + this.gridSize / 2,
        this.gridSize + this.gridSize / 2,
        i === 0 ? 'head' : 'body'
      );
      segment.setOrigin(0.5);
      segment.setScale(0.8);
      this.snake.push(segment);
    }
  }

  moveSnake() {
    // Update direction
    this.direction = this.nextDirection;

    // Get the position for the new head
    let x = this.snake[0].x;
    let y = this.snake[0].y;

    switch (this.direction) {
      case 'left':
        x -= this.gridSize;
        break;
      case 'right':
        x += this.gridSize;
        break;
      case 'up':
        y -= this.gridSize;
        break;
      case 'down':
        y += this.gridSize;
        break;
    }

    // Move body (each segment takes the position of the segment in front of it)
    for (let i = this.snake.length - 1; i > 0; i--) {
      this.snake[i].x = this.snake[i - 1].x;
      this.snake[i].y = this.snake[i - 1].y;
    }

    // Move head
    this.snake[0].x = x;
    this.snake[0].y = y;
  }

  handleInput() {
    // Prevent reversing direction
    if (this.cursors.left.isDown && this.direction !== 'right') {
      this.nextDirection = 'left';
    } else if (this.cursors.right.isDown && this.direction !== 'left') {
      this.nextDirection = 'right';
    } else if (this.cursors.up.isDown && this.direction !== 'down') {
      this.nextDirection = 'up';
    } else if (this.cursors.down.isDown && this.direction !== 'up') {
      this.nextDirection = 'down';
    }
  }

  repositionFood() {
    // Calculate grid positions
    const gridWidth = Math.floor(this.sys.game.config.width / this.gridSize);
    const gridHeight = Math.floor(this.sys.game.config.height / this.gridSize);

    // Generate random position
    let x, y;
    let validPosition = false;

    while (!validPosition) {
      x = Phaser.Math.Between(0, gridWidth - 1) * this.gridSize + this.gridSize / 2;
      y = Phaser.Math.Between(0, gridHeight - 1) * this.gridSize + this.gridSize / 2;

      // Check if position overlaps with snake
      validPosition = true;
      for (let segment of this.snake) {
        if (segment.x === x && segment.y === y) {
          validPosition = false;
          break;
        }
      }
    }

    this.food.x = x;
    this.food.y = y;
  }

  checkFood() {
    // Check if the head collides with food
    if (this.snake[0].x === this.food.x && this.snake[0].y === this.food.y) {
      // Grow snake
      const tail = this.snake[this.snake.length - 1];
      const newSegment = this.physics.add.image(tail.x, tail.y, 'body');
      newSegment.setOrigin(0.5);
      newSegment.setScale(0.8);
      this.snake.push(newSegment);

      // Reposition food
      this.repositionFood();

      // Update score
      this.score += 10;
      this.scoreText.setText('Score: ' + this.score);

      // Increase speed (makes game harder as you progress)
      if (this.speed > 30) {
        this.speed -= 1;
      }
    }
  }

  checkCollision() {
    const head = this.snake[0];
    const width = this.sys.game.config.width;
    const height = this.sys.game.config.height;

    // Check wall collision
    if (head.x < 0 || head.x >= width || head.y < 0 || head.y >= height) {
      this.gameOver();
      return;
    }

    // Check self collision (start from 4th segment to prevent false collisions)
    for (let i = 4; i < this.snake.length; i++) {
      if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
        this.gameOver();
        return;
      }
    }
  }

  gameOver() {
    this.isGameOver = true;
    this.gameOverText.setVisible(true);
  }
}

// Initialize Phaser with the scene
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [SnakeScene]
};

// Start the game immediately
const game = new Phaser.Game(config);
`;

// Initialize Phaser with the scene
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [SnakeScene]
};

// Start the game immediately
const game = new Phaser.Game(config); 