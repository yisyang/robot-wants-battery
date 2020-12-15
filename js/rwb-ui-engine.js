import * as PIXI from 'pixi.js';

export default class RwbUiEngine {
  constructor(gameState, displayOptions = {}) {
    // For access to up to date game state.
    this.gameState = gameState;

    // Supports window resize.
    this.displayOptions = {
      width: null,
      height: null,
      board: {},
      controls: {},
      startScreen: {},
      holderDivId: '',
      gridCountX: 0,
      gridCountY: 0,
      maxPlayersCount: 4, // Hardcoded.
    };
    this.displayOptions = Object.assign(this.displayOptions, displayOptions);
    this.displayOptions.autoResize = (this.displayOptions.width === null || this.displayOptions.height === null);

    // Local view data.
    this.data = {
      menu: {
        mapDifficulty: this.gameState.get('mapDifficulty'),
        playerController: [1, 0, 0, 0],
      },
    };

    // Create alias for Pixi textures.
    this.textures = null;

    // Properties .ui holds various Pixi objects.
    this.ui = {
      // Pixi containers
      containers: {
        base: null,
        map: null,
        sprites: null,
        controls: null,
        messages: null,
        menuMain: null,
        menuPause: null,
      },
      // Pixi sprites as JS objects
      objects: {
        btnAbandon: null,
        btnPause: null,
        btnResume: null,
        btnStartGame: null,
        btnUp: null,
        btnDown: null,
        btnLeft: null,
        btnRight: null,
        menuBase: null,
        menuOptionsArea: null,
        menuMainControls: [],
        controllerFaces: [],
        mapDifficulty: null,
        diceFaces: [],
        messages: {
          title: null,
          mapInfo: null,
          gameTurn: null,
          playerTurn: null,
          gameScore: null,
          hiScore: null,
        },
        playerPieces: [],
        tiles: [],
      },
    };

    this.renderer = new PIXI.Application({
      width: 100, // dummy values
      height: 100,
      backgroundColor: 0xe0e0e0,
    });

    this.handleEvents();
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

  clearStage() {
    // Clear map and sprites containers.
    for (const container of ['map', 'sprites']) {
      for (let i = this.ui.containers[container].length - 1; i >= 0; i--) {
        this.ui.containers[container].removeChild(this.ui.containers[container][i]);
      }
    }
    this.ui.objects.playerPieces = [];
    this.ui.objects.tiles = [];
  }

  clearUiMessages() {
    for (const message of this.ui.objects.messages) {
      message.text = '';
    }
  }

  computeBaseGridSize() {
    this.computeDisplaySize();

    const gridSizePxX = this.displayOptions.width / (this.displayOptions.gridCountX + 2);
    // Additional 10% height reserved for turn/score display.
    const gridSizePxY = this.displayOptions.height / (this.displayOptions.gridCountY + 2) / 1.1;
    const gridSizePxBeforeReserveMin = Math.floor(Math.min(gridSizePxX, gridSizePxY));
    // Reserve 30% width or height for other UI controls.
    const gridSizePxAfterReserveMax = Math.floor(Math.max(gridSizePxX, gridSizePxY) / 1.3);
    const gridSizePx = Math.min(gridSizePxBeforeReserveMin, gridSizePxAfterReserveMax);
    if (gridSizePx < 20) {
      throw Error('Error: Grid size too small to be playable! Please increase grid width/height.');
    }
    return gridSizePx;
  }

  computeDisplaySize() {
    if (this.displayOptions.autoResize) {
      const windowSize = RwbUiEngine.getViewportSize();
      this.displayOptions.width = windowSize.width;
      this.displayOptions.height = windowSize.height;
    }
  }

  computeGameLayout() {
    this.displayOptions.gridSizePx = this.computeBaseGridSize();

    // Analyze container AR vs board AR, and determine if the rest of UI should be portrait of landscape.
    const containerAR = this.displayOptions.width / this.displayOptions.height;
    // Additional 10% height reserved for turn/score display.
    const boardAR = this.displayOptions.gridCountX / this.displayOptions.gridCountY / 1.1;
    this.displayOptions.board.width = this.displayOptions.gridSizePx * this.displayOptions.gridCountX;
    this.displayOptions.board.height = this.displayOptions.gridSizePx * this.displayOptions.gridCountY;

    this.displayOptions.board.marginTop = Math.floor(
      (1 + 0.1 * this.displayOptions.gridCountY) * this.displayOptions.gridSizePx,
    );
    if (containerAR > boardAR) {
      this.displayOptions.displayMode = 'landscape';
      this.displayOptions.board.marginLeft = this.displayOptions.gridSizePx;
      this.displayOptions.board.widthWithMargin = this.displayOptions.board.width
        + 2 * this.displayOptions.board.marginLeft;
      this.displayOptions.board.heightWithMargin = this.displayOptions.height;
      this.displayOptions.controls.marginLeft = this.displayOptions.board.widthWithMargin;
      this.displayOptions.controls.marginTop = 0;
      this.displayOptions.controls.width = this.displayOptions.width - this.displayOptions.controls.marginLeft;
      this.displayOptions.controls.height = this.displayOptions.board.heightWithMargin;
    } else {
      this.displayOptions.displayMode = 'portrait';
      this.displayOptions.board.marginLeft = Math.floor(
        (this.displayOptions.width - this.displayOptions.board.width) / 2,
      );
      this.displayOptions.board.widthWithMargin = this.displayOptions.width;
      this.displayOptions.board.heightWithMargin = this.displayOptions.board.height
        + this.displayOptions.board.marginTop + this.displayOptions.gridSizePx;
      this.displayOptions.controls.marginLeft = 0;
      this.displayOptions.controls.marginTop = this.displayOptions.board.heightWithMargin;
      this.displayOptions.controls.width = this.displayOptions.board.widthWithMargin;
      this.displayOptions.controls.height = this.displayOptions.height - this.displayOptions.controls.width;
    }

    this.displayOptions.infoTextSize = Math.floor(
      0.035 * this.displayOptions.gridCountY * this.displayOptions.gridSizePx,
    );
  }

  computeMenuLayout() {
    this.computeDisplaySize();

    this.displayOptions.startScreen.width = this.displayOptions.width;
    this.displayOptions.startScreen.height = this.displayOptions.height;
    if (this.displayOptions.height > this.displayOptions.width) {
      this.displayOptions.startScreen.marginTop = (this.displayOptions.height - this.displayOptions.width) / 2;
    } else {
      this.displayOptions.startScreen.marginTop = 0;
    }

    // Calculate display unit as 1/100 of the smaller dimension.
    const du = 1 / 100 * Math.min(this.displayOptions.width, this.displayOptions.height);

    this.displayOptions.menuFontSize = 4 * du;
    this.displayOptions.titleFontSize = 8 * du;
  }

  createRectangle(name, data) {
    const rect = new PIXI.Graphics();
    rect.beginFill(data.fill || 0x000000);
    rect.drawRect(0, 0, 1, 1);
    rect.endFill();
    this.ui.objects[name] = rect;
    this.ui.containers[data.container || 'base'].addChild(rect);
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
      this.ui.objects.playerPieces[i] = piece;
      this.ui.containers.sprites.addChild(piece);
    }
  }

  createUiMessage(name, options = {}) {
    const defaultOptions = {
      fill: 0xf0f0f0,
      align: 'left',
      container: 'messages',
    };
    const extendedOptions = Object.assign(defaultOptions, options);
    const message = new PIXI.Text(options.text || '');
    this.ui.objects.messages[name] = message;
    this.ui.containers[extendedOptions.container].addChild(message);
    this.updateUiMessage(name, extendedOptions);
  }

  /**
   * Hack to allow this class to listen to events.
   */
  handleEvents() {
    // Create a DOM EventTarget object
    const target = document.createTextNode(null);

    // Pass EventTarget interface calls to DOM EventTarget object
    this.addEventListener = target.addEventListener.bind(target);
    this.removeEventListener = target.removeEventListener.bind(target);
    this.dispatchEvent = target.dispatchEvent.bind(target);
  }

  handleWindowResize() {
    if (this.gameState.get('gameStatus') === 0) {
      this.ui.containers.base.visible = true
      this.ui.containers.menuMain.visible = true
      this.ui.containers.menuPause.visible = false
      this.ui.containers.map.visible = false
      this.ui.containers.sprites.visible = false
      this.ui.containers.controls.visible = false
      this.ui.containers.messages.visible = false
      this.computeMenuLayout();
    } else {
      this.ui.containers.base.visible = false
      this.ui.containers.menuMain.visible = false
      this.ui.containers.menuPause.visible = this.gameState.get('gameStatus') === 2;
      this.ui.containers.map.visible = true
      this.ui.containers.sprites.visible = true
      this.ui.containers.controls.visible = true
      this.ui.containers.messages.visible = true
      this.computeGameLayout();
    }
    this.repositionUiElements();
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
      for (const container of ['base', 'map', 'sprites', 'controls', 'messages', 'menuPause', 'menuMain']) {
        this.ui.containers[container] = new PIXI.Container();
        this.renderer.stage.addChild(this.ui.containers[container]);
      }

      // Init menu.
      this.initMenu();

      // Init game components.
      this.initGameControls();
      this.initUiMessages();

      // Init main frame rendering loop.
      this.renderer.ticker.add(() => {
        this.renderLoop();
      });

      // Register resize handler.
      if (this.displayOptions.autoResize) {
        window.addEventListener('resize', () => {
          this.handleWindowResize();
        });
      }
    });
  }

  initGameControls() {
    // Draw base board.
    this.createRectangle('board', { fill: 0x3090ff, container: 'map' });
    this.createRectangle('controlsArea', { fill: 0x303030, container: 'map' });

    // Init pause menu buttons.
    for (const btnText of ['Resume', 'Abandon']) {
      const btn = new PIXI.Sprite(this.textures[`btn-${btnText.toLowerCase()}`]);
      this.ui.objects[`btn${btnText}`] = btn;
      this.ui.containers.menuPause.addChild(btn);
    }

    // Pause button.
    const btnPause = new PIXI.Sprite(this.textures['btn-pause']);
    this.ui.objects.btnPause = btnPause;
    this.ui.containers.menuPause.addChild(btnPause);

    // Dice faces.
    // Two dice, init at 0.
    for (let i = 0; i < 2; i++) {
      const diceFace = new PIXI.Sprite(this.textures['dice-face-0']);
      this.ui.objects.diceFaces.push(diceFace);
      this.ui.containers.controls.addChild(diceFace);

      // Dice controls.
      // Two sets, one for each dice.
      for (const direction of ['Up', 'Down', 'Left', 'Right']) {
        const btn = new PIXI.Sprite(this.textures[`btn-${direction.toLowerCase()}`]);
        this.ui.objects[`btnDice${i}${direction}`] = btn;
        this.ui.containers.controls.addChild(btn);
      }
    }
  }

  initMenu() {
    this.createRectangle('menuBase', { fill: 0x3090ff });
    this.createRectangle('menuOptionsArea', { fill: 0x303030 });

    // Menu title.
    this.createUiMessage('title', { container: 'menuMain', fill: 0xffffff, align: 'center' });

    // Submenu players.
    this.createUiMessage('menuPlayers', { container: 'menuMain', fill: 0xffffff, align: 'center' });

    // Menu title.
    this.createUiMessage('menuDifficulty', { container: 'menuMain', fill: 0xffffff, align: 'center' });

    // Controller faces.
    for (let i = 0; i < this.displayOptions.maxPlayersCount; i++) {
      const texture = `face-${this.data.menu.playerController[i]}`;
      const btn = new PIXI.Sprite(this.textures[texture]);
      this.ui.objects.controllerFaces.push(btn);
      this.ui.containers.menuMain.addChild(btn);
    }

    // Map difficulty.
    const btnDifficulty = new PIXI.Sprite(this.textures[`difficulty-${this.data.menu.mapDifficulty}`]);
    this.ui.objects.mapDifficulty = btnDifficulty;
    this.ui.containers.menuMain.addChild(btnDifficulty);

    // Add 8 arrow buttons for swapping map difficulty and players 2-4 controller.
    for (let i = 0; i < 10; i++) {
      const texture = i % 2 === 0 ? 'btn-left' : 'btn-right';
      const btn = new PIXI.Sprite(this.textures[texture]);
      btn.interactive = true;
      this.ui.objects.menuMainControls.push(btn);
      this.ui.containers.menuMain.addChild(btn);
      if (i < 2) {
        btn.on('click', () => {
          this.toggleMapDifficulty(i % 2 === 0);
        });
      } else {
        btn.on('click', () => {
          this.togglePlayer(Math.floor(i / 2), i % 2 === 0);
        });
      }
    }

    // Start game button.
    const btnStart = new PIXI.Sprite(this.textures['btn-start']);
    btnStart.interactive = true;
    this.ui.objects.btnStartGame = btnStart;
    this.ui.containers.menuMain.addChild(btnStart);
    btnStart.on('click', () => {
      this.dispatchEvent(new CustomEvent('newGame', { detail: this.data.menu }));
    });
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
      if (this.ui.objects.messages.playerTurn.y > this.displayOptions.infoTextSize) {
        this.ui.objects.messages.playerTurn.y -= Math.ceil(this.displayOptions.board.heightWithMargin / 400);
        if (this.ui.objects.messages.playerTurn.y < 1.2 * this.displayOptions.infoTextSize) {
          this.updateUiMessage('playerTurn', {
            fontSize: this.displayOptions.infoTextSize,
            x: this.displayOptions.board.widthWithMargin / 2,
            y: this.displayOptions.infoTextSize,
          });
        }
      }
    }
  }

  repositionMapTiles() {
    const marginX = Math.floor(this.displayOptions.board.marginLeft + 0.5 * this.displayOptions.gridSizePx);
    const marginY = Math.floor(this.displayOptions.board.marginTop + 0.5 * this.displayOptions.gridSizePx);

    // Note PIXI sprites are anchored at center middle.
    const iMax = Math.min(this.displayOptions.gridCountX, this.ui.objects.tiles.length);
    for (let i = 0; i < iMax; i++) {
      const jMax = Math.min(this.displayOptions.gridCountY, this.ui.objects.tiles[i].length);
      for (let j = 0; j < jMax; j++) {
        const offsetX = marginX + i * this.displayOptions.gridSizePx;
        const offsetY = marginY + j * this.displayOptions.gridSizePx;
        this.ui.objects.tiles[i][j].width = this.displayOptions.gridSizePx;
        this.ui.objects.tiles[i][j].height = this.displayOptions.gridSizePx;
        this.ui.objects.tiles[i][j].position.set(offsetX, offsetY);
      }
    }
  }

  repositionMenu() {
    const { marginTop } = this.displayOptions.startScreen;
    this.ui.objects.menuBase.width = this.displayOptions.startScreen.width;
    this.ui.objects.menuBase.height = this.displayOptions.startScreen.height;
    this.ui.objects.menuOptionsArea.width = this.displayOptions.startScreen.width;
    this.ui.objects.menuOptionsArea.height = 8.125 * this.displayOptions.titleFontSize;
    this.ui.objects.menuOptionsArea.y = marginTop + 2.25 * this.displayOptions.titleFontSize;

    this.updateUiMessage('title', {
      text: 'Robot Wants Battery',
      fontSize: this.displayOptions.titleFontSize,
      x: this.displayOptions.startScreen.width / 2,
      y: marginTop + this.displayOptions.titleFontSize,
    });

    this.updateUiMessage('menuDifficulty', {
      text: 'Map Difficulty',
      fontSize: this.displayOptions.menuFontSize,
      x: this.displayOptions.startScreen.width / 2,
      y: marginTop + 3 * this.displayOptions.titleFontSize,
    });

    this.ui.objects.mapDifficulty.width = 1.5 * this.displayOptions.titleFontSize;
    this.ui.objects.mapDifficulty.height = 1.5 * this.displayOptions.titleFontSize;
    this.ui.objects.mapDifficulty.position.set(
      this.displayOptions.startScreen.width / 2,
      marginTop + 4.5 * this.displayOptions.titleFontSize,
    );

    this.updateUiMessage('menuPlayers', {
      text: 'Players',
      fontSize: this.displayOptions.menuFontSize,
      x: this.displayOptions.startScreen.width / 2,
      y: marginTop + 7 * this.displayOptions.titleFontSize,
    });

    for (let i = 0; i < this.displayOptions.maxPlayersCount; i++) {
      this.ui.objects.controllerFaces[i].width = 1.5 * this.displayOptions.titleFontSize;
      this.ui.objects.controllerFaces[i].height = 1.5 * this.displayOptions.titleFontSize;
      this.ui.objects.controllerFaces[i].position.set(
        (i + 1) / 5 * this.displayOptions.startScreen.width,
        marginTop + 8.5 * this.displayOptions.titleFontSize,
      );
    }

    // Difficulty and player buttons.
    for (let i = 0; i < 8; i++) {
      this.ui.objects.menuMainControls[i].width = 0.5 * this.displayOptions.titleFontSize;
      this.ui.objects.menuMainControls[i].height = 0.5 * this.displayOptions.titleFontSize;
      let x;
      let y;
      const xAdjustment = (i % 2 === 0 ? -1 : 1) * 0.45 * this.displayOptions.titleFontSize;
      if (i < 2) {
        // Difficulty buttons.
        x = this.displayOptions.startScreen.width / 2 + xAdjustment;
        y = marginTop + 5.75 * this.displayOptions.titleFontSize;
      } else {
        // Player buttons.
        x = Math.floor(i / 2 + 1) / 5 * this.displayOptions.startScreen.width + xAdjustment;
        y = marginTop + 9.75 * this.displayOptions.titleFontSize;
      }
      this.ui.objects.menuMainControls[i].position.set(x, y);
    }

    this.ui.objects.btnStartGame.width = 3.5 * this.displayOptions.titleFontSize;
    this.ui.objects.btnStartGame.height = 3.5 * this.displayOptions.titleFontSize / 3.2;
    this.ui.objects.btnStartGame.position.set(
      this.displayOptions.startScreen.width / 2,
      marginTop + 11.5 * this.displayOptions.titleFontSize,
    );
  }

  repositionPlayerPieces() {
    const marginX = Math.floor(this.displayOptions.board.marginLeft + 0.5 * this.displayOptions.gridSizePx);
    const marginY = Math.floor(this.displayOptions.board.marginTop + 0.5 * this.displayOptions.gridSizePx);
    const halfGridSizePx = this.displayOptions.gridSizePx / 2;

    const playersCount = Math.min(this.gameState.get('playersCount'), this.ui.objects.playerPieces.length);
    for (let i = 0; i < playersCount; i++) {
      const piece = this.ui.objects.playerPieces[i];
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
        piece.x = offsetX;
        piece.y = offsetY;
      }
    }
  }

  repositionGameControls() {
    this.ui.objects.controlsArea.position.set(
      this.displayOptions.controls.marginLeft,
      this.displayOptions.controls.marginTop,
    );
    this.ui.objects.controlsArea.width = this.displayOptions.controls.width;
    this.ui.objects.controlsArea.height = this.displayOptions.controls.height;
  }

  repositionUiMessages() {
    // Update game status messages at top.
    const left = 2.5 * this.displayOptions.infoTextSize;
    const center = 2.5 * this.displayOptions.board.widthWithMargin / 2;
    const right = this.displayOptions.board.widthWithMargin - this.displayOptions.infoTextSize;
    const row1 = this.displayOptions.infoTextSize;
    const row2 = 2.5 * this.displayOptions.infoTextSize;
    this.updateUiMessage('mapInfo', { x: left, y: row1, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('gameTurn', { x: left, y: row2, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('playerTurn', { x: center, y: row1, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('gameScore', { x: right, y: row1, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('hiScore', { x: right, y: row2, fontSize: this.displayOptions.infoTextSize });
  }

  repositionUiElements() {
    // Resize engine area.
    this.renderer.renderer.resize(
      this.displayOptions.width, this.displayOptions.height,
    );

    // Resize game board.
    this.ui.objects.board.width = this.displayOptions.board.widthWithMargin;
    this.ui.objects.board.height = this.displayOptions.board.heightWithMargin;

    if (this.gameState.get('gameStatus') === 0) {
      // Outside of game.
      // Reposition menu.
      this.repositionMenu();
    } else {
      // In-game.
      // Reposition various messages.
      this.repositionUiMessages();

      // Reposition map tiles.
      this.repositionMapTiles();

      // Reposition player pieces.
      this.repositionPlayerPieces();

      // Reposition controls.
      this.repositionGameControls();
    }
  }

  togglePlayer(index, isPrevious = false) {
    // If previous index is empty, then player cannot be toggled.
    if (this.data.menu.playerController[index - 1] === 0) {
      return
    }
    let newController = this.data.menu.playerController[index] + (isPrevious ? -1 : 1);
    if (newController < 0) {
      newController = 3;
    }
    if (newController > 3) {
      newController = 0;
    }
    this.data.menu.playerController[index] = newController;
    this.ui.objects.controllerFaces[index].texture = this.textures[`face-${newController}`];
    // If current index is now empty, toggle all players after current player to become empty.
    if (newController === 0) {
      for (let i = index + 1; i < 4; i++) {
        this.data.menu.playerController[i] = 0;
        this.ui.objects.controllerFaces[i].texture = this.textures[`face-0`];
      }
    }
  }

  toggleMapDifficulty(isPrevious = false) {
    let newDifficulty = this.data.menu.mapDifficulty + (isPrevious ? -1 : 1);
    if (newDifficulty < 0) {
      newDifficulty = 3;
    }
    if (newDifficulty > 3) {
      newDifficulty = 0;
    }
    this.data.menu.mapDifficulty = newDifficulty;
    this.ui.objects.mapDifficulty.texture = this.textures[`difficulty-${newDifficulty}`];
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
}
