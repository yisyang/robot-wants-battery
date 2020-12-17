import * as PIXI from 'pixi.js';
import { get as deepGet } from 'lodash-es';
import RwbUiGame from './rwb-ui-game';
import RwbUiMenu from './rwb-ui-menu';

export default class RwbUiEngine {
  constructor(gameState, options = {}) {
    // Supports window resize.
    this.options = {
      width: null,
      height: null,
      // game: {},
      holderDivId: '',
      gridCountX: 0,
      gridCountY: 0,
    };
    Object.assign(this.options, options);
    this.options.autoResize = (this.options.width === null || this.options.height === null);

    this.gameState = gameState;

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
        controls: {
          btnCancel: null,
          btnConfirm: null,
          btnPause: null,
        },
        map: {
          board: null,
          controlsArea: null,
        },
        menu: {
          btnStartGame: null,
          mapDifficulty: null,
          controls: [],
        },
        menuPause: {
          btnAbandon: null,
          btnResume: null,
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

    // Init modules.
    this.modules = {
      game: new RwbUiGame(this, gameState),
      menu: new RwbUiMenu(this, gameState),
    };

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
      rollDice: null,
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

  computeDisplaySize() {
    if (this.options.autoResize) {
      const windowSize = RwbUiEngine.getViewportSize();
      this.options.width = windowSize.width;
      this.options.height = windowSize.height;
    }

    // Calculate display unit as 1/100 of the smaller dimension.
    this.options.du = 1 / 100 * Math.min(this.options.width, this.options.height);
  }

  createContainerRectangle(name, data) {
    const rect = new PIXI.Graphics();
    rect.beginFill(data.fill || 0x000000);
    rect.drawRect(0, 0, 1, 1);
    rect.endFill();
    this.ui.objects[data.container || 'base'][name] = rect;
    this.ui.containers[data.container || 'base'].addChild(rect);
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
    return message;
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
    document.getElementById(this.options.holderDivId).appendChild(this.renderer.view);

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
      this.modules.menu.init();

      // Init game components.
      this.modules.game.init();

      // Init main frame rendering loop.
      this.renderer.ticker.add(() => {
        this.renderLoop();
      });

      // Register resize handler.
      if (this.options.autoResize) {
        window.addEventListener('resize', () => {
          this.refreshDisplay();
        });
      }
    });
  }

  refreshDisplay() {
    // Resize engine area.
    this.computeDisplaySize();
    this.renderer.renderer.resize(
      this.options.width, this.options.height,
    );

    // Show/hide as needed.
    this.ui.containers.base.visible = false;
    this.ui.containers.menuMain.visible = false;
    this.ui.containers.menuPause.visible = false;
    this.ui.containers.map.visible = false;
    this.ui.containers.sprites.visible = false;
    this.ui.containers.controls.visible = false;
    this.ui.containers.messages.visible = false;
    if (this.gameState.get('gameStatus') === 0) {
      // In menu.
      this.ui.containers.base.visible = true;
      this.ui.containers.menuMain.visible = true;
    } else if (this.gameState.get('gameStatus') === 2) {
      // Paused game.
      this.ui.containers.base.visible = true;
      this.ui.containers.menuPause.visible = true;
    } else {
      // Active/finished game.
      this.ui.containers.map.visible = true;
      this.ui.containers.sprites.visible = true;
      this.ui.containers.controls.visible = true;
      this.ui.containers.messages.visible = true;
    }

    this.modules.menu.refreshDisplay();
    this.modules.game.refreshDisplay();
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

      // Special: roll dice
      if (tData.rollDice !== null) {
        const diceFace = Math.floor(Math.random() * 6) + 1;
        tObj.texture = this.textures[`dice-face-${diceFace}`];
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
