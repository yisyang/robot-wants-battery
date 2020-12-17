import * as PIXI from 'pixi.js';
import { get as deepGet } from 'lodash-es';

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
      game: {},
      startScreen: {},
      holderDivId: '',
      gridCountX: 0,
      gridCountY: 0,
      maxPlayersCount: 4, // Hardcoded.
    };
    Object.assign(this.displayOptions, displayOptions);
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
      // Pixi containers.
      containers: {
        base: null,
        map: null,
        sprites: null,
        controls: null,
        messages: null,
        menuMain: null,
        menuPause: null,
      },
      // Pixi sprites as JS objects.
      objects: {
        base: {
          menuBase: null,
          menuOptionsArea: null,
        },
        map: {
          board: null,
          controlsArea: null,
        },
        menu: {
          btnAbandon: null,
          btnPause: null,
          btnResume: null,
          btnStartGame: null,
          mapDifficulty: null,
          controls: [],
        },
        messages: {
          title: null,
          mapDifficulty: null,
          mapSeed: null,
          gameTurn: null,
          playerTurn: null,
          gameScore: null,
          hiScore: null,
        },
        controllerFaces: [],
        diceFaces: [],
        playerPieces: [],
        tiles: [],
      },
      // References to objects currently undergoing transition.
      transition: {},
    };

    this.renderer = new PIXI.Application({
      width: 100, // dummy values
      height: 100,
      backgroundColor: 0x202020,
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

  addTransition(element, options) {
    const tData = {
      cb: null,
      element, // String of subpath from ui.objects.
      translate: null,
      scale: null,
      rotate: null,
      step: 0,
      steps: 100,
      ...options,
    };
    const tObj = deepGet(this.ui.objects, tData.element);
    // Perform initial sanitizations.
    for (const [key, attrs] of Object.entries({ translate: ['x', 'y'], scale: ['width', 'height'] })) {
      const tDataProp = tData[key];
      const [attr1, attr2] = attrs;
      if (tDataProp !== null && tDataProp.from === undefined) {
        tDataProp.from = {};
        tDataProp.from[attr1] = tObj[attr1];
        tDataProp.from[attr2] = tObj[attr2];
      }
    }
    this.ui.transition[element] = tData;
  }

  clearGameMap() {
    // Clear map and sprites containers.
    this.ui.objects.tiles.map((row) => {
      row.map((tile) => {
        this.ui.containers.map.removeChild(tile);
      });
    });
    this.ui.objects.tiles = [];
    this.ui.objects.playerPieces.map((pp) => {
      this.ui.containers.sprites.removeChild(pp);
    });
    this.ui.objects.playerPieces = [];

    // Clear messages.
    for (const message of Object.values(this.ui.objects.messages)) {
      if (message !== null) {
        message.text = '';
      }
    }
  }

  computeBaseGridSize() {
    this.computeDisplaySize();

    const gridSizePxX = this.displayOptions.width / (this.displayOptions.gridCountX + 2);
    // Additional 10% height reserved for turn/score display.
    const gridSizePxY = this.displayOptions.height / (this.displayOptions.gridCountY + 2) / 1.1;
    const gridSizePxBeforeReserveMin = Math.floor(Math.min(gridSizePxX, gridSizePxY));
    // Reserve 33% width or height for other UI controls.
    const gridSizePxAfterReserveMax = Math.floor(Math.max(gridSizePxX, gridSizePxY) / 1.33);
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

    // Calculate display unit as 1/100 of the smaller dimension.
    this.displayOptions.du = 1 / 100 * Math.min(this.displayOptions.width, this.displayOptions.height);
  }

  computeGameLayout() {
    this.displayOptions.gridSizePx = this.computeBaseGridSize();

    // Analyze container AR vs board AR, and determine if the rest of UI should be portrait of landscape.
    const containerAR = this.displayOptions.width / this.displayOptions.height;
    // Additional 10% height reserved for turn/score display on board area.
    const boardAR = this.displayOptions.gridCountX / this.displayOptions.gridCountY / 1.1;
    this.displayOptions.board.width = this.displayOptions.gridSizePx * this.displayOptions.gridCountX;
    this.displayOptions.board.height = this.displayOptions.gridSizePx * this.displayOptions.gridCountY;

    this.displayOptions.board.pt = Math.floor(
      (1 + 0.1 * this.displayOptions.gridCountY) * this.displayOptions.gridSizePx,
    );
    if (containerAR > boardAR) {
      this.displayOptions.displayMode = 'landscape';
      this.displayOptions.game.mx = Math.max(0, (this.displayOptions.width - 1.4 * this.displayOptions.height) / 2);
      this.displayOptions.game.my = 0;
      this.displayOptions.board.px = this.displayOptions.gridSizePx;
      this.displayOptions.board.widthWP = this.displayOptions.board.width
        + 2 * this.displayOptions.board.px;
      this.displayOptions.board.heightWP = this.displayOptions.height;
      this.displayOptions.controls.x = this.displayOptions.game.mx + this.displayOptions.board.widthWP;
      this.displayOptions.controls.y = this.displayOptions.game.my;
      this.displayOptions.controls.width = this.displayOptions.width
        - this.displayOptions.controls.x - this.displayOptions.game.mx;
      this.displayOptions.controls.height = this.displayOptions.board.heightWP;
    } else {
      this.displayOptions.displayMode = 'portrait';
      this.displayOptions.game.mx = 0;
      this.displayOptions.game.my = Math.max(0, (this.displayOptions.height - 1.4 * this.displayOptions.width) / 2);
      this.displayOptions.board.px = Math.floor(
        (this.displayOptions.width - this.displayOptions.board.width) / 2,
      );
      this.displayOptions.board.widthWP = this.displayOptions.width;
      this.displayOptions.board.heightWP = this.displayOptions.board.height
        + this.displayOptions.board.pt + this.displayOptions.gridSizePx;
      this.displayOptions.controls.x = this.displayOptions.game.mx;
      this.displayOptions.controls.y = this.displayOptions.game.my + this.displayOptions.board.heightWP;
      this.displayOptions.controls.width = this.displayOptions.board.widthWP;
      this.displayOptions.controls.height = this.displayOptions.height
        - this.displayOptions.controls.y - this.displayOptions.game.my;
    }

    this.displayOptions.controls.du = 1 / 100 * Math.min(
      this.displayOptions.controls.width, this.displayOptions.controls.height,
    );

    this.displayOptions.infoTextSize = Math.floor(
      0.035 * this.displayOptions.gridCountY * this.displayOptions.gridSizePx,
    );
  }

  computeMenuLayout() {
    this.computeDisplaySize();

    this.displayOptions.startScreen.width = this.displayOptions.width;
    this.displayOptions.startScreen.height = this.displayOptions.height;
    if (this.displayOptions.height > this.displayOptions.width) {
      this.displayOptions.startScreen.my = (this.displayOptions.height - this.displayOptions.width) / 2;
    } else {
      this.displayOptions.startScreen.my = 0;
    }

    this.displayOptions.menuFontSize = 4 * this.displayOptions.du;
    this.displayOptions.titleFontSize = 8 * this.displayOptions.du;
  }

  createContainerRectangle(name, data) {
    const rect = new PIXI.Graphics();
    rect.beginFill(data.fill || 0x000000);
    rect.drawRect(0, 0, 1, 1);
    rect.endFill();
    this.ui.objects[data.container || 'base'][name] = rect;
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
    const extendedOptions = { ...defaultOptions, ...options };
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
          this.refreshDisplay();
        });
      }
    });
  }

  initGameControls() {
    // Draw base board.
    this.createContainerRectangle('board', { fill: 0x3090ff, container: 'map' });
    this.createContainerRectangle('controlsArea', { fill: 0x303030, container: 'map' });

    // Init pause menu related buttons.
    for (const btnText of ['Resume', 'Abandon', 'Pause']) {
      const btn = new PIXI.Sprite(this.textures[`btn-${btnText.toLowerCase()}`]);
      btn.interactive = true;
      btn.on('click', () => {
        this.dispatchEvent(new CustomEvent(btnText.toLowerCase(), {}));
      });
      this.ui.objects.menu[`btn${btnText}`] = btn;
    }
    this.ui.containers.menuPause.addChild(this.ui.objects.menu.btnResume);
    this.ui.containers.menuPause.addChild(this.ui.objects.menu.btnAbandon);
    // Pause button itself is displayed on main game screen.
    this.ui.containers.controls.addChild(this.ui.objects.menu.btnPause);

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
        btn.interactive = true;
        this.ui.objects[`btnDice${i}${direction}`] = btn;
        this.ui.containers.controls.addChild(btn);
      }
    }
  }

  initMenu() {
    this.createContainerRectangle('menuBase', { fill: 0x3090ff });
    this.createContainerRectangle('menuOptionsArea', { fill: 0x303030 });

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
    this.ui.objects.menu.mapDifficulty = btnDifficulty;
    this.ui.containers.menuMain.addChild(btnDifficulty);

    // Add 8 arrow buttons for swapping map difficulty and players 2-4 controller.
    for (let i = 0; i < 8; i++) {
      const texture = i % 2 === 0 ? 'btn-left' : 'btn-right';
      const btn = new PIXI.Sprite(this.textures[texture]);
      btn.interactive = true;
      this.ui.objects.menu.controls.push(btn);
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

    this.updateMenuPlayerVisibility();

    // Start game button.
    const btnStart = new PIXI.Sprite(this.textures['btn-start']);
    btnStart.interactive = true;
    this.ui.objects.menu.btnStartGame = btnStart;
    this.ui.containers.menuMain.addChild(btnStart);
    btnStart.on('click', () => {
      this.dispatchEvent(new CustomEvent('newGame', { detail: this.data.menu }));
    });
  }

  initUiMessages() {
    this.createUiMessage('mapDifficulty');
    this.createUiMessage('mapSeed');
    this.createUiMessage('gameTurn', { align: 'center' });
    this.createUiMessage('playerTurn', { align: 'center' });
    this.createUiMessage('gameScore', { align: 'right' });
    this.createUiMessage('hiScore', { align: 'right' });
  }

  nextTurn() {
    const currentActivePlayer = this.gameState.get('currentActivePlayer');
    const currentTurn = this.gameState.get('currentTurn');

    this.updateUiMessage('gameTurn', { text: `Turn: ${currentTurn}` });
    this.updateUiMessage('gameScore', { text: `Score: ${this.gameState.get('currentScore')}` });

    const playerName = this.gameState.get(`players.${currentActivePlayer}.name`);
    this.updateUiMessage('playerTurn', {
      text: `${playerName}'s turn.`,
      fill: this.gameState.get('gameOptions.playerColors')[currentActivePlayer],
      fontSize: 1.2 * this.displayOptions.gridSizePx,
      x: this.displayOptions.game.mx + this.displayOptions.board.widthWP / 2,
      y: this.displayOptions.game.my + this.displayOptions.board.heightWP / 2,
    });
    this.addTransition('messages.playerTurn', {
      translate: { y: this.displayOptions.game.my + 4 * this.displayOptions.infoTextSize },
      cb: () => {
        this.updateUiMessage('playerTurn', {
          x: this.displayOptions.game.mx + this.displayOptions.board.widthWP / 2,
          y: this.displayOptions.game.my + 2.5 * this.displayOptions.infoTextSize,
          fontSize: this.displayOptions.infoTextSize,
        });
      },
    });
  }

  refreshDisplay() {
    this.ui.containers.base.visible = false;
    this.ui.containers.menuMain.visible = false;
    this.ui.containers.menuPause.visible = false;
    this.ui.containers.map.visible = false;
    this.ui.containers.sprites.visible = false;
    this.ui.containers.controls.visible = false;
    this.ui.containers.messages.visible = false;
    this.computeMenuLayout();
    if (this.gameState.get('gameStatus') === 0) {
      // In menu.
      this.ui.containers.base.visible = true;
      this.ui.containers.menuMain.visible = true;
    } else if (this.gameState.get('gameStatus') === 2) {
      // Paused game.
      this.ui.containers.base.visible = true;
      this.ui.containers.menuPause.visible = true;
      this.computeGameLayout();
    } else {
      // Active/finished game.
      this.ui.containers.map.visible = true;
      this.ui.containers.sprites.visible = true;
      this.ui.containers.controls.visible = true;
      this.ui.containers.messages.visible = true;
      this.computeGameLayout();
    }
    this.repositionUi();
  }

  renderLoop() {
    // Animation logic.
    // Currently only supports basic linear translate/scale/rotate.
    for (const [element, tData] of Object.entries(this.ui.transition)) {
      const tObj = deepGet(this.ui.objects, tData.element);
      tData.step += 1;
      tData.stepProgress = 1 / tData.steps;
      tData.progress = Math.min(1, tData.step / tData.steps);

      // Handle translate and scale.
      for (const [key, attrs] of Object.entries({ translate: ['x', 'y'], scale: ['width', 'height'] })) {
        const tDataProp = tData[key];
        if (tDataProp !== null) {
          for (const attr of attrs) {
            if (Object.prototype.hasOwnProperty.call(tDataProp, attr)) {
              tObj[attr] = tDataProp.from[attr] + tData.progress * (tDataProp[attr] - tDataProp.from[attr]);
            }
          }
        }
      }

      // Handle rotate
      if (tData.rotate !== null) {
        const stepRotate = tData.stepProgress * tData.rotate;
        tObj.rotation += stepRotate;
      }

      // Done
      if (tData.step >= tData.steps) {
        delete this.ui.transition[element];
        // Optional callback on done.
        if (typeof (tData.cb) === 'function') {
          tData.cb();
        }
      }
    }
  }

  repositionGameControls() {
    // Update pause menu.
    for (const btnText of ['Resume', 'Abandon']) {
      this.ui.objects.menu[`btn${btnText}`].width = 32 * this.displayOptions.du;
      this.ui.objects.menu[`btn${btnText}`].height = 10 * this.displayOptions.du;
    }
    this.ui.objects.menu.btnResume.position.set(this.displayOptions.width / 2, 40 * this.displayOptions.du);
    this.ui.objects.menu.btnAbandon.position.set(this.displayOptions.width / 2, 60 * this.displayOptions.du);

    // Update controls area.
    this.ui.objects.map.controlsArea.position.set(
      this.displayOptions.controls.x,
      this.displayOptions.controls.y,
    );
    this.ui.objects.map.controlsArea.width = this.displayOptions.controls.width;
    this.ui.objects.map.controlsArea.height = this.displayOptions.controls.height;

    // Pause button.
    this.ui.objects.menu.btnPause.width = 15 * this.displayOptions.controls.du;
    this.ui.objects.menu.btnPause.height = 15 * this.displayOptions.controls.du;
    this.ui.objects.menu.btnPause.position.set(
      this.displayOptions.controls.x + this.displayOptions.controls.width - 10 * this.displayOptions.controls.du,
      this.displayOptions.controls.y + 10 * this.displayOptions.controls.du,
    );

    // Dice faces.
    const baselineX = this.displayOptions.game.mx
      + this.displayOptions.board.widthWP + 50 * this.displayOptions.controls.du;
    const baselineY = this.displayOptions.game.my
      + this.displayOptions.board.heightWP + 50 * this.displayOptions.controls.du;
    const diceFacePos = [
      [baselineX, baselineY],
      [baselineX, baselineY],
    ];
    if (this.displayOptions.displayMode === 'landscape') {
      // Landscape.
      diceFacePos[0][1] = 0.27 * this.displayOptions.controls.height;
      diceFacePos[1][1] = 0.73 * this.displayOptions.controls.height;
    } else {
      // Portrait.
      diceFacePos[0][0] = 0.27 * this.displayOptions.controls.width;
      diceFacePos[1][0] = 0.73 * this.displayOptions.controls.width;
    }
    // Two dice, init at 0.
    for (let i = 0; i < 2; i++) {
      this.ui.objects.diceFaces[i].width = 25 * this.displayOptions.controls.du;
      this.ui.objects.diceFaces[i].height = 25 * this.displayOptions.controls.du;
      this.ui.objects.diceFaces[i].position.set(diceFacePos[i][0], diceFacePos[i][1]);

      // Dice controls.
      for (const val of Object.values([
        ['Up', 0, -1],
        ['Down', 0, 1],
        ['Left', -1, 0],
        ['Right', 1, 0],
      ])) {
        const btn = this.ui.objects[`btnDice${i}${val[0]}`];
        btn.width = 12 * this.displayOptions.controls.du;
        btn.height = 12 * this.displayOptions.controls.du;
        btn.position.set(
          diceFacePos[i][0] + 25 * val[1] * this.displayOptions.controls.du,
          diceFacePos[i][1] + 25 * val[2] * this.displayOptions.controls.du,
        );
      }
    }
  }

  repositionGameMessages() {
    // Update game status messages at top.
    const left = this.displayOptions.game.mx + 2.5 * this.displayOptions.infoTextSize;
    const center = this.displayOptions.game.mx + this.displayOptions.board.widthWP / 2;
    const right = this.displayOptions.game.mx + this.displayOptions.board.widthWP - this.displayOptions.infoTextSize;
    const row1 = this.displayOptions.game.my + this.displayOptions.infoTextSize;
    const row2 = this.displayOptions.game.my + 2.5 * this.displayOptions.infoTextSize;
    this.updateUiMessage('mapDifficulty', { x: left, y: row1, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('mapSeed', { x: left, y: row2, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('gameTurn', { x: center, y: row1, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('playerTurn', { x: center, y: row2, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('gameScore', { x: right, y: row1, fontSize: this.displayOptions.infoTextSize });
    this.updateUiMessage('hiScore', { x: right, y: row2, fontSize: this.displayOptions.infoTextSize });
  }

  repositionMapTiles() {
    const marginX = Math.floor(this.displayOptions.game.mx + this.displayOptions.board.px
      + 0.5 * this.displayOptions.gridSizePx);
    const marginY = Math.floor(this.displayOptions.game.my + this.displayOptions.board.pt
      + 0.5 * this.displayOptions.gridSizePx);

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
    const { my } = this.displayOptions.startScreen;
    this.ui.objects.base.menuBase.width = this.displayOptions.startScreen.width;
    this.ui.objects.base.menuBase.height = this.displayOptions.startScreen.height;
    this.ui.objects.base.menuOptionsArea.width = this.displayOptions.startScreen.width;
    this.ui.objects.base.menuOptionsArea.height = 8.125 * this.displayOptions.titleFontSize;
    this.ui.objects.base.menuOptionsArea.y = my + 2.25 * this.displayOptions.titleFontSize;

    this.updateUiMessage('title', {
      text: 'Robot Wants Battery',
      fontSize: this.displayOptions.titleFontSize,
      x: this.displayOptions.startScreen.width / 2,
      y: my + this.displayOptions.titleFontSize,
    });

    this.updateUiMessage('menuDifficulty', {
      text: 'Map Difficulty',
      fontSize: this.displayOptions.menuFontSize,
      x: this.displayOptions.startScreen.width / 2,
      y: my + 3 * this.displayOptions.titleFontSize,
    });

    this.ui.objects.menu.mapDifficulty.width = 1.5 * this.displayOptions.titleFontSize;
    this.ui.objects.menu.mapDifficulty.height = 1.5 * this.displayOptions.titleFontSize;
    this.ui.objects.menu.mapDifficulty.position.set(
      this.displayOptions.startScreen.width / 2,
      my + 4.5 * this.displayOptions.titleFontSize,
    );

    this.updateUiMessage('menuPlayers', {
      text: 'Players',
      fontSize: this.displayOptions.menuFontSize,
      x: this.displayOptions.startScreen.width / 2,
      y: my + 7 * this.displayOptions.titleFontSize,
    });

    for (let i = 0; i < this.displayOptions.maxPlayersCount; i++) {
      this.ui.objects.controllerFaces[i].width = 1.5 * this.displayOptions.titleFontSize;
      this.ui.objects.controllerFaces[i].height = 1.5 * this.displayOptions.titleFontSize;
      this.ui.objects.controllerFaces[i].position.set(
        (i + 1) / 5 * this.displayOptions.startScreen.width,
        my + 8.5 * this.displayOptions.titleFontSize,
      );
    }

    // Difficulty and player buttons.
    for (let i = 0; i < 8; i++) {
      this.ui.objects.menu.controls[i].width = 0.5 * this.displayOptions.titleFontSize;
      this.ui.objects.menu.controls[i].height = 0.5 * this.displayOptions.titleFontSize;
      let x;
      let y;
      const xAdjustment = (i % 2 === 0 ? -1 : 1) * 0.45 * this.displayOptions.titleFontSize;
      if (i < 2) {
        // Difficulty buttons.
        x = this.displayOptions.startScreen.width / 2 + xAdjustment;
        y = my + 5.75 * this.displayOptions.titleFontSize;
      } else {
        // Player buttons.
        x = Math.floor(i / 2 + 1) / 5 * this.displayOptions.startScreen.width + xAdjustment;
        y = my + 9.75 * this.displayOptions.titleFontSize;
      }
      this.ui.objects.menu.controls[i].position.set(x, y);
    }

    this.ui.objects.menu.btnStartGame.width = 3.5 * this.displayOptions.titleFontSize;
    this.ui.objects.menu.btnStartGame.height = 3.5 * this.displayOptions.titleFontSize / 3.2;
    this.ui.objects.menu.btnStartGame.position.set(
      this.displayOptions.startScreen.width / 2,
      my + 11.5 * this.displayOptions.titleFontSize,
    );
  }

  repositionPlayerPieces() {
    const marginX = Math.floor(
      this.displayOptions.game.mx + this.displayOptions.board.px + 0.5 * this.displayOptions.gridSizePx,
    );
    const marginY = Math.floor(
      this.displayOptions.game.my + this.displayOptions.board.pt + 0.5 * this.displayOptions.gridSizePx,
    );
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

  repositionUi() {
    // Resize engine area.
    this.renderer.renderer.resize(
      this.displayOptions.width, this.displayOptions.height,
    );

    // Resize game board.
    this.ui.objects.map.board.x = this.displayOptions.game.mx;
    this.ui.objects.map.board.y = this.displayOptions.game.my;
    this.ui.objects.map.board.width = this.displayOptions.board.widthWP;
    this.ui.objects.map.board.height = this.displayOptions.board.heightWP;

    // Always reposition menu.
    this.repositionMenu();

    // In-game.
    if (this.gameState.get('gameStatus') > 0) {
      // Reposition various messages.
      this.repositionGameMessages();

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
      return;
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

    this.updateMenuPlayerVisibility();
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
    this.ui.objects.menu.mapDifficulty.texture = this.textures[`difficulty-${newDifficulty}`];
  }

  updateMenuPlayerVisibility() {
    // Hide faces and arrows of all None players but the first.
    let indexFirstNone = this.displayOptions.maxPlayersCount;
    for (let i = 1; i < this.displayOptions.maxPlayersCount; i++) {
      const controller = this.data.menu.playerController[i];
      let visible = true;
      if (controller === 0) {
        if (i <= indexFirstNone) {
          indexFirstNone = i;
          // Also assign all future controllers to 0.
          for (let j = i + 1; j < this.displayOptions.maxPlayersCount; j++) {
            this.data.menu.playerController[j] = 0;
            this.ui.objects.controllerFaces[j].texture = this.textures['face-0'];
          }
        } else {
          visible = false;
        }
      }
      this.ui.objects.controllerFaces[i].visible = visible;
      this.ui.objects.menu.controls[i * 2].visible = visible;
      this.ui.objects.menu.controls[i * 2 + 1].visible = visible;
    }
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
