/* eslint-disable no-console */

import * as PIXI from 'pixi.js';
import RandomSeeder from './random-seeder.js';

export default class RwbGameEngine {
  constructor(holderId, width, height, gridSizePx = 32) {
    this.gameOptions = {
      holderDivId: holderId,
      canvasId: `${holderId}-canvas`,
      height,
      width,
      gridSizePx,
      difficulty: 1, // 0/1/2/3 = easy/normal/deadly/impossible
      playerCount: 4,
      playerLocations: [],
      maxScore: 100,
      waterTileChances: [0.05, 0.15, 0.25, 0.35], // Based on difficulty
      textures: null,
      playerColors: [0x0028db, 0xff002a, 0x0dfd00, 0xe9b600],
    };
    this.gameControls = {};
    this.gameStatus = {
      currentGameTurn: 1,
      currentActivePlayer: 0,
      currentScore: 100, // -8/-4/-2/-1 per turn on easy/normal/difficult/impossible
      alive: [],
      scores: [],
      bestScore: {
        difficulty: 'easy',
        score: 999,
      },
      isWaterTile: [],
    };
    this.ui = {};
    this.spriteObjects = {
      players: [],
      tiles: [],
    };

    // Add computed options
    this.gameOptions.gridCountX = Math.floor(width / gridSizePx) - 2;
    this.gameOptions.gridCountY = Math.floor(height / gridSizePx) - 2;
    this.gameOptions.startLocation = { x: 3, y: 3 };
    this.gameOptions.endLocation = {
      x: Math.floor(width / gridSizePx) - 6,
      y: Math.floor(height / gridSizePx) - 6,
    };

    if (this.gameOptions.gridSizePx < 20) {
      throw Error('Error: Grid size too small to be playable! Please increase grid width/height.');
    }
    if (this.gameOptions.gridCountX < 10 || this.gameOptions.gridCountY < 10) {
      throw Error('Error: Grid count too few to be playable! Please increase canvas width/height.');
    }

    this.renderer = new PIXI.Application({
      width: this.gameOptions.width,
      height: this.gameOptions.height,
      backgroundColor: 0x3090ff,
    });

    this.initStage().then(() => {
      this.initUiControls();
      this.initUiDisplay();
      this.reset();
    }).catch((e) => {
      console.log('Failed to initialize PIXI stage.');
      console.error(e);
    });
  }

  static createButton(text, width, height) {
    const button = document.createElement('button');
    button.innerText = text;
    button.style.border = '1px solid #000000';
    button.style.borderRadius = '5px';
    button.style.backgroundColor = '#e8e8e8';
    button.style.width = width;
    button.style.height = height;

    return button;
  }

  initUiControls() {
    const seedInput = document.createElement('input');
    seedInput.placeholder = 'Map Seed (optional)';
    seedInput.style.border = '1px solid #000000';
    seedInput.style.borderRadius = '5px';
    seedInput.style.backgroundColor = '#e8e8e8';
    this.gameControls.seedInput = seedInput;
    document.getElementById(this.gameOptions.holderDivId).appendChild(seedInput);

    const buttonStartGame = RwbGameEngine.createButton('Start Game', '100px', '50px');
    const buttonResetGame = RwbGameEngine.createButton('Reset Game', '100px', '50px');
    this.gameControls.buttonStartGame = buttonStartGame;
    this.gameControls.buttonResetGame = buttonResetGame;
    document.getElementById(this.gameOptions.holderDivId).appendChild(buttonStartGame);
    document.getElementById(this.gameOptions.holderDivId).appendChild(buttonResetGame);

    buttonStartGame.addEventListener('click', () => {
      this.startGame();
    });
    buttonResetGame.addEventListener('click', () => {
      this.reset();
    });
  }

  initUiDisplay() {
    const seedDisplay = document.createElement('input');
    seedDisplay.disabled = true;
    seedDisplay.value = '';
    seedDisplay.style.display = 'none';
    seedDisplay.style.border = '1px solid #000000';
    seedDisplay.style.borderRadius = '5px';
    seedDisplay.style.backgroundColor = '#e8e8e8';
    this.gameControls.seedDisplay = seedDisplay;
    document.getElementById(this.gameOptions.holderDivId).appendChild(seedDisplay);

    const msgPlayerTurn = new PIXI.Text('', {
      fontSize: 0.5 * this.gameOptions.gridSizePx,
      fill: 0xf0f0f0,
      align: 'center',
    });
    msgPlayerTurn.anchor.set(0.5);
    this.gameStatus.msgPlayerTurn = msgPlayerTurn;
    this.ui.messages.addChild(msgPlayerTurn);

    const msgGameTurn = new PIXI.Text('', {
      fontSize: 0.5 * this.gameOptions.gridSizePx,
      fill: 0xf0f0f0,
      align: 'left',
    });
    msgGameTurn.anchor.set(0, 0.5);
    msgGameTurn.position.set(this.gameOptions.gridSizePx / 2, this.gameOptions.gridSizePx / 2);
    this.gameStatus.msgGameTurn = msgGameTurn;
    this.ui.messages.addChild(msgGameTurn);

    const msgGameScore = new PIXI.Text('', {
      fontSize: 0.5 * this.gameOptions.gridSizePx,
      fill: 0xf0f0f0,
      align: 'right',
    });
    msgGameScore.anchor.set(1.0, 0.5);
    msgGameScore.position.set(
      this.gameOptions.width - this.gameOptions.gridSizePx / 2, this.gameOptions.gridSizePx / 2,
    );
    this.gameStatus.msgGameScore = msgGameScore;
    this.ui.messages.addChild(msgGameScore);
  }

  startGame() {
    this.nextTurn();
  }

  nextTurn() {
    if (this.gameStatus.currentActivePlayer >= this.gameOptions.playerCount) {
      this.gameStatus.currentGameTurn += 1;
      const scoreReductionMultiplier = 2 ** (3 - this.gameOptions.difficulty);
      this.gameStatus.currentScore = Math.max(0,
        this.gameOptions.maxScore - this.gameStatus.currentGameTurn * scoreReductionMultiplier);
      this.gameStatus.currentActivePlayer = 0;
    }

    this.gameStatus.msgGameTurn.text = `Turn: ${this.gameStatus.currentGameTurn}`;
    this.gameStatus.msgGameScore.text = `Score: ${this.gameStatus.currentScore}`;

    this.gameStatus.currentActivePlayer += 1;
    this.gameStatus.msgPlayerTurn.text = `Player ${this.gameStatus.currentActivePlayer}'s turn.`;
    this.gameStatus.msgPlayerTurn.style.fontSize = 1.2 * this.gameOptions.gridSizePx;
    this.gameStatus.msgPlayerTurn.style.fill = this.gameOptions.playerColors[this.gameStatus.currentActivePlayer - 1];
    this.gameStatus.msgPlayerTurn.position.set(this.gameOptions.width / 2, this.gameOptions.height / 2);
  }

  initStage() {
    document.getElementById(this.gameOptions.holderDivId).appendChild(this.renderer.view);

    return new Promise((resolve, reject) => {
      try {
        this.renderer.loader.add('rwb', './img/sprites.json').load((loader, resources) => {
          resolve(resources);
        });
      } catch (e) {
        reject(e);
      }
    }).then((resources) => {
      this.gameOptions.textures = resources.rwb.textures;

      // Make multi-layer structure to ensure some items can display above others.
      const map = new PIXI.Container();
      const sprites = new PIXI.Container();
      const messages = new PIXI.Container();
      this.ui.map = map;
      this.ui.sprites = sprites;
      this.ui.messages = messages;
      this.renderer.stage.addChild(map);
      this.renderer.stage.addChild(sprites);
      this.renderer.stage.addChild(messages);

      // Listen for frame updates
      this.renderer.ticker.add(() => {
        this.renderLoop();
      });
    });
  }

  renderLoop() {
    // each frame we spin the bunny around a bit
    // bunny.rotation -= 0.01;

    // this.clearStage();
    if (this.gameStatus.msgPlayerTurn.y > 0.6 * this.gameOptions.gridSizePx) {
      this.gameStatus.msgPlayerTurn.y -= 2;
      if (this.gameStatus.msgPlayerTurn.y < 0.6 * this.gameOptions.gridSizePx) {
        this.gameStatus.msgPlayerTurn.style.fontSize = 0.5 * this.gameOptions.gridSizePx;
        this.gameStatus.msgPlayerTurn.style.fill = 0xf0f0f0;
        this.gameStatus.msgPlayerTurn.position.set(this.gameOptions.width / 2, this.gameOptions.gridSizePx / 2);
      }
    }
  }

  createGamePieces(x, y) {
    for (let i = this.gameOptions.playerCount; i > 0; i--) {
      const piece = new PIXI.Sprite(this.gameOptions.textures[`p${String(i)}`]);
      piece.width = this.gameOptions.gridSizePx - 12;
      piece.height = this.gameOptions.gridSizePx - 12;
      if (i === 1) {
        piece.x = x - 6;
        piece.y = y + 6;
      } else if (i === 2) {
        piece.x = x + 6;
        piece.y = y + 6;
      } else if (i === 3) {
        piece.x = x - 6;
        piece.y = y - 6;
      } else {
        piece.x = x + 6;
        piece.y = y - 6;
      }
      this.spriteObjects.players.push(piece);
      this.ui.sprites.addChild(piece);
    }
  }

  createGameTile(textureName, x, y) {
    const tile = new PIXI.Sprite(this.gameOptions.textures[textureName]);
    tile.width = this.gameOptions.gridSizePx;
    tile.height = this.gameOptions.gridSizePx;
    tile.x = x;
    tile.y = y;
    this.spriteObjects.tiles.push(tile);
    this.ui.map.addChild(tile);
  }

  clearStage() {
    // Clear player pieces.
    for (let i = this.spriteObjects.players.length - 1; i >= 0; i--) {
      this.ui.sprites.removeChild(this.spriteObjects.players[i]);
    }

    // Clear map tiles.
    for (let i = this.spriteObjects.tiles.length - 1; i >= 0; i--) {
      this.ui.map.removeChild(this.spriteObjects.tiles[i]);
    }

    // Hide seed display.
    this.gameControls.seedDisplay.value = '';
    this.gameControls.seedDisplay.style.display = 'none';

    // Hide turn message.
    this.ui.messages.removeChild(this.gameControls.msgPlayerTurn);
  }

  resetTiles() {
    let seedPhrase = this.gameControls.seedInput.value;
    if (seedPhrase === null || seedPhrase === '') {
      seedPhrase = Math.floor(Math.random() * 1e6).toString();
    }
    this.gameControls.seedDisplay.value = seedPhrase;
    const randomSeeder = new RandomSeeder(seedPhrase);

    // Compute water tiles.
    this.gameStatus.isWaterTile = [];
    const waterTileChances = this.gameOptions.waterTileChances[this.gameOptions.difficulty];
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      this.gameStatus.isWaterTile[i] = [];
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        this.gameStatus.isWaterTile[i][j] = randomSeeder.rand() < waterTileChances;
      }
    }

    // Hard-code start and end locations as non-water.
    this.gameStatus.isWaterTile[this.gameOptions.startLocation.x][this.gameOptions.startLocation.y] = false;
    this.gameStatus.isWaterTile[this.gameOptions.endLocation.x][this.gameOptions.endLocation.y] = false;

    // Draw map.
    // Note margins are padded with 1/2 of this.gameOptions.gridSizePx
    // because PIXI sprites are anchored at center middle.
    const marginX = Math.floor((this.gameOptions.width + this.gameOptions.gridSizePx
      - this.gameOptions.gridCountX * this.gameOptions.gridSizePx) / 2);
    const marginY = Math.floor((this.gameOptions.height + this.gameOptions.gridSizePx
      - this.gameOptions.gridCountY * this.gameOptions.gridSizePx) / 2);

    // Start drawing grids, assuming each square has 1px inner border.
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        const offsetX = marginX + i * this.gameOptions.gridSizePx;
        const offsetY = marginY + j * this.gameOptions.gridSizePx;
        if (this.gameStatus.isWaterTile[i][j]) {
          this.createGameTile(`water${String((2 * i + 3 * j) % 4 + 1)}`, offsetX, offsetY);
        } else {
          this.createGameTile(`land${String((i + j) % 2 + 1)}`, offsetX, offsetY);
        }
      }
    }

    // Render start and end locations.
    const startImgOffsetX = marginX + this.gameOptions.startLocation.x * this.gameOptions.gridSizePx;
    const startImgOffsetY = marginY + this.gameOptions.startLocation.y * this.gameOptions.gridSizePx;
    this.createGameTile('home', startImgOffsetX, startImgOffsetY);

    const endImgOffsetX = marginX + this.gameOptions.endLocation.x * this.gameOptions.gridSizePx;
    const endImgOffsetY = marginY + this.gameOptions.endLocation.y * this.gameOptions.gridSizePx;
    this.createGameTile('battery', endImgOffsetX, endImgOffsetY);

    // Place player pieces.
    this.createGamePieces(startImgOffsetX, startImgOffsetY);
  }

  reset() {
    this.clearStage();
    this.resetTiles();

    this.gameStatus.currentScore = this.gameOptions.maxScore;
    this.gameStatus.currentGameTurn = 1;
    this.gameStatus.currentActivePlayer = 0;
    this.gameStatus.alive = [];
    this.gameStatus.scores = [];

    this.gameStatus.msgGameTurn.text = '';
    this.gameStatus.msgGameScore.text = '';
    this.gameStatus.msgPlayerTurn.text = '';
  }
}
