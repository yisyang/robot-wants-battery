import * as PIXI from 'pixi.js';

export default class RwbUiEngine {
  constructor(gameState, displayOptions = {}) {
    // For access to up to date game state.
    this.gameState = gameState;

    // Supports window resize.
    this.displayOptions = {
      holderDivId: '',
      gridCountX: 0,
      gridCountY: 0,
    };
    this.displayOptions = Object.assign(this.displayOptions, displayOptions);

    // Create alias for Pixi textures.
    this.textures = null;

    // Properties .ui holds various Pixi objects.
    this.ui = {
      // Pixi containers
      containers: {
        base: null,
        map: null,
        sprites: null,
        messages: null,
      },
      // JS objects
      objects: {
        messages: {
          mapInfo: null,
          gameTurn: null,
          playerTurn: null,
          gameScore: null,
          hiScore: null,
        },
        players: [],
        tiles: [],
      },
    };

    this.renderer = new PIXI.Application({
      width: 100, // dummy values
      height: 100,
      backgroundColor: 0xe0e0e0,
    });
  }

  /**
   * Get browser window size for dynamic scaling.
   *
   * @returns {{width: *, height: *}}
   */
  static getViewportSize() {
    let e = window;
    let a = 'inner';
    if (!Object.prototype.hasOwnProperty.call(window, 'innerWidth')) {
      a = 'client';
      e = document.documentElement || document.body;
    }
    return { width: e[`${a}Width`], height: e[`${a}Height`] };
  }

  /**
   * Initialize game UI.
   *
   * @returns {Promise<void>}
   */
  init() {
    document.getElementById(this.displayOptions.holderDivId).appendChild(this.renderer.view);

    return new Promise((resolve, reject) => {
      try {
        this.renderer.loader.add('rwb', './img/sprites.json').load((loader, resources) => {
          resolve(resources);
        });
      } catch (e) {
        reject(e);
      }
    }).then((resources) => {
      // noinspection JSUnresolvedVariable
      this.textures = resources.rwb.textures;

      // Make multi-layer stage to ensure some sprites can display above others.
      for (const container of ['base', 'map', 'sprites', 'messages']) {
        this.ui.containers[container] = new PIXI.Container();
        this.renderer.stage.addChild(this.ui.containers[container]);
      }

      // Draw base board.
      const board = new PIXI.Graphics();
      board.beginFill(0x3090ff);
      board.drawRect(0, 0, 1, 1);
      board.endFill();
      this.ui.objects.board = board;
      this.ui.containers.base.addChild(board);

      // Init other components.
      this.initUiControls();
      this.initUiMessages();

      // Init main frame rendering loop.
      this.renderer.ticker.add(() => {
        this.renderLoop();
      });

      // Register resize handler.
      window.addEventListener('resize', () => {
        this.handleWindowResize();
      });
    });
  }

  clearStage() {
    // Clear player pieces.
    for (let i = this.ui.containers.sprites.length - 1; i >= 0; i--) {
      this.ui.containers.sprites.removeChild(this.ui.containers.sprites[i]);
    }
    this.ui.objects.players = [];

    // Clear map tiles.
    for (let i = this.ui.containers.map.length - 1; i >= 0; i--) {
      this.ui.containers.map.removeChild(this.ui.containers.map[i]);
    }
    this.ui.objects.tiles = [];
  }

  clearUiMessages() {
    for (const message of this.ui.objects.messages) {
      message.text = '';
    }
  }

  computeDisplayOptions() {
    const windowSize = RwbUiEngine.getViewportSize();
    this.displayOptions.width = this.displayOptions.width || windowSize.width;
    this.displayOptions.height = this.displayOptions.height || windowSize.height;

    const gridSizePxX = this.displayOptions.width / (this.displayOptions.gridCountX + 2);
    // Additional 10% height reserved for turn/score display.
    const gridSizePxY = this.displayOptions.height / (this.displayOptions.gridCountY + 2) / 1.1;
    this.displayOptions.gridSizePx = Math.floor(Math.min(gridSizePxX, gridSizePxY));
    if (this.displayOptions.gridSizePx < 20) {
      throw Error('Error: Grid size too small to be playable! Please increase grid width/height.');
    }

    // Analyze container AR vs board AR, and determine if the rest of UI should be portrait of landscape.
    const containerAR = this.displayOptions.width / this.displayOptions.height;
    // Additional 10% height reserved for turn/score display.
    const boardAR = this.displayOptions.gridCountX / this.displayOptions.gridCountY / 1.1;
    this.displayOptions.boardWidth = this.displayOptions.gridSizePx * this.displayOptions.gridCountX;
    this.displayOptions.boardHeight = this.displayOptions.gridSizePx * this.displayOptions.gridCountY;

    this.displayOptions.boardMarginTop = Math.floor(
      (1 + 0.1 * this.displayOptions.gridCountY) * this.displayOptions.gridSizePx,
    );
    if (containerAR > boardAR) {
      this.displayOptions.displayMode = 'landscape';
      this.displayOptions.boardMarginLeft = this.displayOptions.gridSizePx;
      this.displayOptions.boardWidthWithMargin = this.displayOptions.boardWidth
        + 2 * this.displayOptions.boardMarginLeft;
      this.displayOptions.boardHeightWithMargin = this.displayOptions.height;
    } else {
      this.displayOptions.displayMode = 'portrait';
      this.displayOptions.boardMarginLeft = Math.floor(
        (this.displayOptions.width - this.displayOptions.boardWidth) / 2,
      );
      this.displayOptions.boardWidthWithMargin = this.displayOptions.width;
      this.displayOptions.boardHeightWithMargin = this.displayOptions.boardHeight
        + this.displayOptions.boardMarginTop + this.displayOptions.gridSizePx;
    }

    this.displayOptions.infoTextSize = Math.floor(
      0.035 * this.displayOptions.gridCountY * this.displayOptions.gridSizePx,
    );
  }

  handleWindowResize() {
    this.computeDisplayOptions();
    this.repositionUiElements();
  }

  /**
   * @param mapTilesData Map tile info as 2D matrix with .type property
   */
  createGameTiles(mapTilesData) {
    this.ui.objects.tiles = [];
    for (let i = 0; i < this.displayOptions.gridCountX; i++) {
      this.ui.objects.tiles[i] = [];
      for (let j = 0; j < this.displayOptions.gridCountY; j++) {
        let textureName;
        switch (mapTilesData[i][j].type) {
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

  /**
   * @param {Number} playersCount Number of players
   */
  createPlayerPieces(playersCount) {
    for (let i = 0; i < playersCount; i++) {
      const textureName = `p${String(i + 1)}`;
      const piece = new PIXI.Sprite(this.textures[textureName]);
      this.ui.objects.players[i] = piece;
      this.ui.containers.sprites.addChild(piece);
    }
  }

  createUiMessage(name, options = {}) {
    const defaultOptions = {
      fill: 0xf0f0f0,
      align: 'left',
    };
    const extendedOptions = Object.assign(defaultOptions, options);
    const message = new PIXI.Text(options.text || '');
    this.ui.objects.messages[name] = message;
    this.ui.containers.messages.addChild(message);
    this.updateUiMessage(name, extendedOptions);
  }

  updateUiMessage(name, options) {
    const message = this.ui.objects.messages[name];
    if (Object.prototype.hasOwnProperty.call(options, 'align')) {
      message.style.align = options.align;
      if (options.align === 'left') {
        message.anchor.set(0, 0.5);
      } else if (options.align === 'right') {
        message.anchor.set(1.0, 0.5);
      } else {
        message.anchor.set(0.5, 0.5);
      }
    }
    if (Object.prototype.hasOwnProperty.call(options, 'fill')) {
      message.style.fill = options.fill;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'fontSize')) {
      message.style.fontSize = options.fontSize;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'text')) {
      message.text = options.text;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'x') && Object.prototype.hasOwnProperty.call(options, 'y')) {
      message.position.set(options.x, options.y);
    }
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
    // const buttonStartGame = RwbApp.createButton('Start Game', '100px', '50px');
    // const buttonResetGame = RwbApp.createButton('Reset Game', '100px', '50px');
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
    this.createUiMessage('mapInfo');
    this.createUiMessage('gameTurn');
    this.createUiMessage('playerTurn', { align: 'center' });
    this.createUiMessage('gameScore', { align: 'right' });
    this.createUiMessage('hiScore', { align: 'right' });
  }

  renderLoop() {
    // each frame we spin the bunny around a bit
    // bunny.rotation -= 0.01;

    if (Object.prototype.hasOwnProperty.call(this.ui.objects.messages, 'playerTurn')) {
      if (this.ui.objects.messages.playerTurn.y > 1.2 * this.displayOptions.infoTextSize) {
        this.ui.objects.messages.playerTurn.y -= 2;
        if (this.ui.objects.messages.playerTurn.y < 1.2 * this.displayOptions.infoTextSize) {
          this.ui.objects.messages.playerTurn.style.fontSize = this.displayOptions.infoTextSize;
          this.ui.objects.messages.playerTurn.style.fill = 0xf0f0f0;
          this.ui.objects.messages.playerTurn.position.set(
            this.displayOptions.boardWidthWithMargin / 2, this.displayOptions.infoTextSize,
          );
        }
      }
    }
  }

  repositionMapTiles() {
    const marginX = Math.floor(this.displayOptions.boardMarginLeft + 0.5 * this.displayOptions.gridSizePx);
    const marginY = Math.floor(this.displayOptions.boardMarginTop + 0.5 * this.displayOptions.gridSizePx);

    // Note PIXI sprites are anchored at center middle.
    for (let i = 0; i < this.displayOptions.gridCountX; i++) {
      for (let j = 0; j < this.displayOptions.gridCountY; j++) {
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

    const playersCount = this.gameState.get('playersCount');
    for (let i = 0; i < playersCount; i++) {
      const piece = this.ui.objects.players[i];
      const playerData = this.gameState.get(`players.${i}`);

      const offsetX = marginX + playerData.x * this.displayOptions.gridSizePx;
      const offsetY = marginY + playerData.y * this.displayOptions.gridSizePx;

      const cnt = this.gameState.countPlayersAtPlayerLocation(i);
      if (cnt > 1) {
        piece.width = halfGridSizePx;
        piece.height = halfGridSizePx;
        piece.x = offsetX + (i % 2 === 0 ? -halfGridSizePx : halfGridSizePx) / 2;
        piece.y = offsetY + (i > 1 ? -halfGridSizePx : halfGridSizePx) / 2;
      } else {
        piece.width = this.displayOptions.gridSizePx;
        piece.height = this.displayOptions.gridSizePx;
        piece.x = offsetX
        piece.y = offsetY
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
    this.ui.objects.messages.mapInfo.position.set(
      this.displayOptions.infoTextSize, this.displayOptions.infoTextSize,
    );
    this.ui.objects.messages.gameTurn.position.set(
      this.displayOptions.infoTextSize, 2.5 * this.displayOptions.infoTextSize,
    );
    this.ui.objects.messages.playerTurn.position.set(
      this.displayOptions.boardWidthWithMargin / 2, this.displayOptions.infoTextSize,
    );
    this.ui.objects.messages.gameScore.position.set(
      this.displayOptions.boardWidthWithMargin - this.displayOptions.infoTextSize,
      this.displayOptions.infoTextSize,
    );
    this.ui.objects.messages.hiScore.position.set(
      this.displayOptions.boardWidthWithMargin - this.displayOptions.infoTextSize,
      2.5 * this.displayOptions.infoTextSize,
    );

    // Set new font size for the messages.
    this.ui.objects.messages.mapInfo.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.messages.gameTurn.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.messages.playerTurn.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.messages.gameScore.style.fontSize = this.displayOptions.infoTextSize;
    this.ui.objects.messages.hiScore.style.fontSize = this.displayOptions.infoTextSize;

    // Reposition map tiles.
    this.repositionMapTiles();

    // Reposition player pieces.
    this.repositionPlayerPieces();
  }
}
