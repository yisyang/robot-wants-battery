/* eslint-disable no-console */

import * as PIXI from 'pixi.js';
import RandomSeeder from './random-seeder.js';

export default class RwbGameEngine {
  constructor(gameOptions) {
    // Options should not be changed once init is complete.
    this.gameOptions = {
      holderDivId: '',
      height: null,
      width: null,
      gridCountX: 16,
      gridCountY: null,
      playerLocations: [],
      maxScore: 100,
      difficultyLabels: ['Easy', 'Normal', 'Hard', 'Impossible'],
      waterTileChances: [0.05, 0.15, 0.25, 0.35], // Corresponds to difficulty 0/1/2/3 (easy/normal/hard/impossible)
      playerColors: [0x0028db, 0xff002a, 0x0dfd00, 0xe9b600], // Corresponds to colors used in player sprites.
    };
    this.gameOptions = Object.assign(this.gameOptions, gameOptions);

    // Populate computed options.
    if (this.gameOptions.gridCountY === null) {
      // noinspection JSSuspiciousNameCombination
      this.gameOptions.gridCountY = this.gameOptions.gridCountX;
    }
    if (this.gameOptions.gridCountX < 10 || this.gameOptions.gridCountY < 10) {
      throw Error('Error: Grid count too few to be playable! Please increase canvas width/height.');
    }
    this.gameOptions.startLocation = { x: 3, y: 3 };
    this.gameOptions.endLocation = {
      x: this.gameOptions.gridCountX - 4,
      y: this.gameOptions.gridCountY - 4,
    };

    // To support window resize, definitely over-engineering it.
    this.displayOptions = {};

    // Persisted state across sessions.
    this.persistedState = {};
    this.loadPersistedState();

    // Game state contains ALL state info for the game in progress,
    // and can be used to re-render the game board.
    this.gameState = {};
    this.resetGameState();

    // Create alias for Pixi textures.
    this.textures = null;

    // Properties .ui holds various Pixi objects.
    this.ui = {
      // Pixi containers
      containers: {},
      // JS objects
      objects: {},
    };

    this.renderer = new PIXI.Application({
      width: 100, // dummy values
      height: 100,
      backgroundColor: 0xe0e0e0,
    });

    this.initStage().then(() => {
      this.initUiControls();
      this.initUiMessages();

      // Register resize handler.
      window.addEventListener('resize', () => {
        this.handleWindowResize();
      });

      // Trigger it manually for initial rendering.
      this.newGame();
    }).catch((e) => {
      console.log('Failed to initialize PIXI stage.');
      console.error(e);
    });
  }

  static getViewportSize() {
    let e = window;
    let a = 'inner';
    if (!('innerWidth' in window)) {
      a = 'client';
      e = document.documentElement || document.body;
    }
    return { width: e[`${a}Width`], height: e[`${a}Height`] };
  }

  clearStage() {
    // Clear player pieces.
    for (let i = this.ui.containers.sprites.length - 1; i >= 0; i--) {
      this.ui.containers.sprites.removeChild(this.ui.containers.sprites[i]);
    }

    // Clear map tiles.
    for (let i = this.ui.containers.map.length - 1; i >= 0; i--) {
      this.ui.containers.map.removeChild(this.ui.containers.map[i]);
    }
    this.ui.objects.tiles = [];

    // // Hide seed display.
    // this.gameControls.seedDisplay.value = '';
    // this.gameControls.seedDisplay.style.display = 'none';

    // // Hide turn message.
    // this.ui.containers.messages.removeChild(this.gameControls.msgPlayerTurn);
  }

  clearUiMessages() {
    this.ui.objects.msgMapInfo = '';
    this.ui.objects.msgGameTurn.text = '';
    this.ui.objects.msgPlayerTurn.text = '';
    this.ui.objects.msgGameScore.text = '';
    this.ui.objects.msgHiScore = '';
  }

  createGamePieces() {
    for (let i = this.gameState.playersCount; i > 0; i--) {
      const n = String(i);
      const piece = new PIXI.Sprite(this.textures[`p${String(i)}`]);
      this.gameState.players[n].sprite = piece;
      this.gameState.players[n].x = this.gameOptions.startLocation.x;
      this.gameState.players[n].y = this.gameOptions.startLocation.y;
      this.ui.containers.sprites.addChild(piece);
    }
  }

  createGameTiles() {
    this.ui.objects.tiles = [];
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      this.ui.objects.tiles[i] = [];
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        let textureName;
        switch (this.gameState.mapTiles[i][j].type) {
          case 'water':
            textureName = `water${String((2 * i + 3 * j) % 4 + 1)}`;
            break;
          case 'start':
            textureName = 'home';
            break;
          case 'end':
            textureName = 'battery';
            break;
          default:
            textureName = `land${String((i + j) % 2 + 1)}`;
            break;
        }
        const tile = new PIXI.Sprite(this.textures[textureName]);
        this.ui.objects.tiles[i][j] = tile;
        this.ui.containers.map.addChild(tile);
      }
    }
  }

  generateBoard() {
    // Seed RNG.
    let seedPhrase = this.gameState.mapSeed;
    if (seedPhrase === null || seedPhrase === '') {
      seedPhrase = Math.floor(Math.random() * 1e6).toString();
      this.gameState.mapSeed = seedPhrase;
    }
    const randomSeeder = new RandomSeeder(seedPhrase);
    this.ui.objects.msgMapInfo.text = `Map Seed: ${seedPhrase}`
    this.ui.objects.msgHiScore.text = `Hi-Score: ${this.persistedState.highScore}`

    // Compute water tiles.
    this.gameState.mapTiles = [];
    const waterTileChances = this.gameOptions.waterTileChances[this.gameState.mapDifficulty];
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      this.gameState.mapTiles[i] = [];
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        this.gameState.mapTiles[i][j] = {
          type: randomSeeder.rand() < waterTileChances ? 'water' : 'land',
        };
      }
    }

    // Hard-code start and end locations as non-water.
    this.gameState.mapTiles[this.gameOptions.startLocation.x][this.gameOptions.startLocation.y].type = 'start';
    this.gameState.mapTiles[this.gameOptions.endLocation.x][this.gameOptions.endLocation.y].type = 'end';

    // Create map tiles.
    this.createGameTiles();

    // Place player pieces.
    this.createGamePieces();
  }

  countPlayersAtLocation(x, y) {
    let cnt = 0;
    for (let i = this.gameState.playersCount; i > 0; i--) {
      const n = String(i);
      if (this.gameState.players[n].x === x && this.gameState.players[n].y === y) {
        cnt += 1;
      }
    }
    return cnt;
  }

  computeDisplayOptions() {
    const windowSize = RwbGameEngine.getViewportSize();
    this.displayOptions.width = this.gameOptions.width || windowSize.width;
    this.displayOptions.height = this.gameOptions.height || windowSize.height;

    const gridSizePxX = this.displayOptions.width / (this.gameOptions.gridCountX + 2);
    // Additional 10% height reserved for turn/score display.
    const gridSizePxY = this.displayOptions.height / (this.gameOptions.gridCountY + 2) / 1.1;
    this.displayOptions.gridSizePx = Math.floor(Math.min(gridSizePxX, gridSizePxY));
    if (this.displayOptions.gridSizePx < 20) {
      throw Error('Error: Grid size too small to be playable! Please increase grid width/height.');
    }

    // Analyze container AR vs board AR, and determine if the rest of UI should be portrait of landscape.
    const containerAR = this.displayOptions.width / this.displayOptions.height;
    // Additional 10% height reserved for turn/score display.
    const boardAR = this.gameOptions.gridCountX / this.gameOptions.gridCountY / 1.1;
    this.displayOptions.boardWidth = this.displayOptions.gridSizePx * this.gameOptions.gridCountX;
    this.displayOptions.boardHeight = this.displayOptions.gridSizePx * this.gameOptions.gridCountY;
    if (containerAR > boardAR) {
      this.displayOptions.displayMode = 'landscape';
      this.displayOptions.boardMarginLeft = this.displayOptions.gridSizePx;
      this.displayOptions.boardMarginTop = Math.floor(
        (1 + 0.1 * this.gameOptions.gridCountY) * this.displayOptions.gridSizePx,
      );
      this.displayOptions.boardWidthWithMargin = this.displayOptions.boardWidth
        + 2 * this.displayOptions.boardMarginLeft;
      this.displayOptions.boardHeightWithMargin = this.displayOptions.height;
    } else {
      this.displayOptions.displayMode = 'portrait';
      this.displayOptions.boardMarginLeft = Math.floor(
        (this.displayOptions.width - this.displayOptions.boardWidth) / 2,
      );
      this.displayOptions.boardMarginTop = Math.floor(
        (1 + 0.1 * this.gameOptions.gridCountY) * this.displayOptions.gridSizePx,
      );
      this.displayOptions.boardWidthWithMargin = this.displayOptions.width;
      this.displayOptions.boardHeightWithMargin = this.displayOptions.boardHeight
        + this.displayOptions.boardMarginTop + this.displayOptions.gridSizePx;
    }

    this.displayOptions.infoTextSize = Math.floor(
      0.035 * this.gameOptions.gridCountY * this.displayOptions.gridSizePx,
    );
  }

  handleWindowResize() {
    this.computeDisplayOptions();
    this.repositionUiElements();
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
      this.textures = resources.rwb.textures;

      // Make multi-layer stage to ensure some sprites can display above others.
      const base = new PIXI.Container();
      const map = new PIXI.Container();
      const sprites = new PIXI.Container();
      const messages = new PIXI.Container();
      this.ui.containers.base = base;
      this.ui.containers.map = map;
      this.ui.containers.sprites = sprites;
      this.ui.containers.messages = messages;
      this.renderer.stage.addChild(base);
      this.renderer.stage.addChild(map);
      this.renderer.stage.addChild(sprites);
      this.renderer.stage.addChild(messages);

      // Draw base board.
      const board = new PIXI.Graphics();
      board.beginFill(0x3090ff);
      board.drawRect(0, 0, 1, 1);
      board.endFill();
      this.ui.objects.board = board;
      this.ui.containers.base.addChild(board);

      // Init main frame rendering loop.
      this.renderer.ticker.add(() => {
        this.renderLoop();
      });
    });
  }

  initUiControls() {
    // const seedInput = document.createElement('input');
    // seedInput.placeholder = 'Map Seed (optional)';
    // seedInput.style.border = '1px solid #000000';
    // seedInput.style.borderRadius = '5px';
    // seedInput.style.backgroundColor = '#e8e8e8';
    // this.gameControls.seedInput = seedInput;
    // document.getElementById(this.gameOptions.holderDivId).appendChild(seedInput);
    //
    // const buttonStartGame = RwbGameEngine.createButton('Start Game', '100px', '50px');
    // const buttonResetGame = RwbGameEngine.createButton('Reset Game', '100px', '50px');
    // this.gameControls.buttonStartGame = buttonStartGame;
    // this.gameControls.buttonResetGame = buttonResetGame;
    // document.getElementById(this.gameOptions.holderDivId).appendChild(buttonStartGame);
    // document.getElementById(this.gameOptions.holderDivId).appendChild(buttonResetGame);
    //
    // buttonStartGame.addEventListener('click', () => {
    //   this.newGame();
    // });
    // buttonResetGame.addEventListener('click', () => {
    //   this.reset();
    // });
  }

  initUiMessages() {
    const msgMapInfo = new PIXI.Text('', {
      fill: 0xf0f0f0,
      align: 'left',
    });
    msgMapInfo.anchor.set(0, 0.5);
    this.ui.objects.msgMapInfo = msgMapInfo;
    this.ui.containers.messages.addChild(msgMapInfo);

    const msgGameTurn = new PIXI.Text('', {
      fill: 0xf0f0f0,
      align: 'left',
    });
    msgGameTurn.anchor.set(0, 0.5);
    this.ui.objects.msgGameTurn = msgGameTurn;
    this.ui.containers.messages.addChild(msgGameTurn);

    const msgPlayerTurn = new PIXI.Text('', {
      fill: 0xf0f0f0,
      align: 'center',
    });
    msgPlayerTurn.anchor.set(0.5);
    this.ui.objects.msgPlayerTurn = msgPlayerTurn;
    this.ui.containers.messages.addChild(msgPlayerTurn);

    const msgGameScore = new PIXI.Text('', {
      fill: 0xf0f0f0,
      align: 'right',
    });
    msgGameScore.anchor.set(1.0, 0.5);
    this.ui.objects.msgGameScore = msgGameScore;
    this.ui.containers.messages.addChild(msgGameScore);

    const msgHiScore = new PIXI.Text('', {
      fill: 0xf0f0f0,
      align: 'right',
    });
    msgHiScore.anchor.set(1.0, 0.5);
    this.ui.objects.msgHiScore = msgHiScore;
    this.ui.containers.messages.addChild(msgHiScore);
  }

  loadPersistedState() {
    this.persistedState.mapDifficulty = window.localStorage.getItem('difficulty') || 1;
    this.persistedState.highScore = window.localStorage.getItem('highScore') || 0;
  }

  newGame() {
    this.savePersistedState();
    this.generateBoard();
    this.handleWindowResize();
    this.nextTurn();
  }

  nextTurn() {
    if (this.gameState.currentActivePlayer >= this.gameState.playersCount) {
      this.gameState.currentTurn += 1;
      const scoreReductionMultiplier = 2 ** (3 - this.gameState.mapDifficulty);
      this.gameState.currentScore = Math.max(0,
        this.gameOptions.maxScore - this.gameState.currentTurn * scoreReductionMultiplier);
      this.gameState.currentActivePlayer = 0;
    }
    this.gameState.currentActivePlayer += 1;

    const difficultyLabel = this.gameOptions.difficultyLabels[this.gameState.mapDifficulty];
    this.ui.objects.msgGameTurn.text = `(${difficultyLabel}) Turn: ${this.gameState.currentTurn}`;
    this.ui.objects.msgGameScore.text = `Score: ${this.gameState.currentScore}`;

    this.ui.objects.msgPlayerTurn.text = `Player ${this.gameState.currentActivePlayer}'s turn.`;
    this.ui.objects.msgPlayerTurn.style.fontSize = 1.2 * this.displayOptions.gridSizePx;
    this.ui.objects.msgPlayerTurn.style.fill = this.gameOptions.playerColors[this.gameState.currentActivePlayer - 1];

    // TODO: Remove once game is playable.
    this.ui.objects.msgPlayerTurn.text = `UNDER CONSTRUCTION\nNot yet playable`
    this.ui.objects.msgPlayerTurn.style.fill = 0xff0000;

    this.ui.objects.msgPlayerTurn.position.set(
      this.displayOptions.boardWidthWithMargin / 2,
      this.displayOptions.boardHeightWithMargin / 2);
  }

  renderLoop() {
    // each frame we spin the bunny around a bit
    // bunny.rotation -= 0.01;

    if (this.ui.objects.msgPlayerTurn.y > 1.2 * this.displayOptions.infoTextSize) {
      this.ui.objects.msgPlayerTurn.y -= 2;
      if (this.ui.objects.msgPlayerTurn.y < 1.2 * this.displayOptions.infoTextSize) {
        this.ui.objects.msgPlayerTurn.style.fontSize = this.displayOptions.infoTextSize;
        this.ui.objects.msgPlayerTurn.style.fill = 0xf0f0f0;
        this.ui.objects.msgPlayerTurn.position.set(
          this.displayOptions.boardWidthWithMargin / 2, this.displayOptions.infoTextSize);
      }
    }
  }

  repositionMapTiles() {
    const marginX = Math.floor(this.displayOptions.boardMarginLeft + 0.5 * this.displayOptions.gridSizePx);
    const marginY = Math.floor(this.displayOptions.boardMarginTop + 0.5 * this.displayOptions.gridSizePx);

    // Note PIXI sprites are anchored at center middle.
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        const offsetX = marginX + i * this.displayOptions.gridSizePx;
        const offsetY = marginY + j * this.displayOptions.gridSizePx;
        this.ui.objects.tiles[i][j].width = this.displayOptions.gridSizePx;
        this.ui.objects.tiles[i][j].height = this.displayOptions.gridSizePx;
        this.ui.objects.tiles[i][j].position.set(offsetX, offsetY);
      }
    }
  }

  repositionPlayerPieces() {
    const marginX = Math.floor(this.displayOptions.boardMarginLeft + 0.5 * this.displayOptions.gridSizePx);
    const marginY = Math.floor(this.displayOptions.boardMarginTop + 0.5 * this.displayOptions.gridSizePx);
    const halfGridSizePx = this.displayOptions.gridSizePx / 2;

    for (let i = this.gameState.playersCount; i > 0; i--) {
      const n = String(i);
      const piece = this.gameState.players[n].sprite;

      const offsetX = marginX + this.gameState.players[n].x * this.displayOptions.gridSizePx;
      const offsetY = marginY + this.gameState.players[n].y * this.displayOptions.gridSizePx;

      const cnt = this.countPlayersAtLocation(this.gameState.players[n].x, this.gameState.players[n].y);
      if (cnt > 1) {
        piece.width = halfGridSizePx;
        piece.height = halfGridSizePx;
        piece.x = offsetX + (i % 2 === 0 ? halfGridSizePx : -halfGridSizePx) / 2;
        piece.y = offsetY + (i > 2 ? -halfGridSizePx : halfGridSizePx) / 2;
      } else {
        piece.width = this.displayOptions.gridSizePx;
        piece.height = this.displayOptions.gridSizePx;
      }
    }
  }

  repositionUiElements() {
    this.renderer.renderer.resize(
      this.displayOptions.width, this.displayOptions.height,
    );
    this.ui.objects.board.width = this.displayOptions.boardWidthWithMargin;
    this.ui.objects.board.height = this.displayOptions.boardHeightWithMargin;

    // Reposition various messages.
    this.ui.objects.msgMapInfo.position.set(
      this.displayOptions.infoTextSize, this.displayOptions.infoTextSize);
    this.ui.objects.msgGameTurn.position.set(
      this.displayOptions.infoTextSize, 2.5 * this.displayOptions.infoTextSize);
    this.ui.objects.msgPlayerTurn.position.set(
      this.displayOptions.boardWidthWithMargin / 2, this.displayOptions.infoTextSize);
    this.ui.objects.msgGameScore.position.set(
      this.displayOptions.boardWidthWithMargin - this.displayOptions.infoTextSize,
      this.displayOptions.infoTextSize,
    );
    this.ui.objects.msgHiScore.position.set(
      this.displayOptions.boardWidthWithMargin - this.displayOptions.infoTextSize,
      2.5 * this.displayOptions.infoTextSize,
    );

    // Set new font size for the messages.
    this.ui.objects.msgMapInfo.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.msgGameTurn.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.msgPlayerTurn.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.msgGameScore.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.msgHiScore.style.fontSize = this.displayOptions.infoTextSize;

    // Reposition map tiles.
    this.repositionMapTiles();

    // Reposition player pieces.
    this.repositionPlayerPieces();
  }

  reset() {
    this.clearStage();
    this.clearUiMessages();
  }

  resetGameState() {
    this.gameState = {
      currentTurn: 1,
      currentScore: this.gameOptions.maxScore, // -8/-4/-2/-1 per turn on easy/normal/difficult/impossible
      currentActivePlayer: 0,
      mapSeed: '',
      mapDifficulty: this.persistedState.mapDifficulty,
      playersCount: 4,
      players: {
        1: {
          controller: 'human', // human, ai-easy, ai-hard
          alive: false,
          score: 0,
          sprite: null,
        },
        2: {
          controller: 'none', // human, ai-easy, ai-hard
          alive: false,
          score: 0,
          sprite: null,
        },
        3: {
          controller: 'none', // human, ai-easy, ai-hard
          alive: false,
          score: 0,
          sprite: null,
        },
        4: {
          controller: 'none', // human, ai-easy, ai-hard
          alive: false,
          score: 0,
          sprite: null,
        },
      },
      playerLocations: [],
      scores: [],
      mapTiles: [],
    };
  }

  savePersistedState() {
    window.localStorage.setItem('difficulty', this.persistedState.mapDifficulty);
    window.localStorage.setItem('highScore', this.persistedState.highScore);
  }

}
