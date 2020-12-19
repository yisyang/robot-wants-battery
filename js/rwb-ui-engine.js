import * as PIXI from 'pixi.js';
import { get as deepGet, debounce } from 'lodash-es';
import RwbUiGame from './rwb-ui-game';
import RwbUiMenu from './rwb-ui-menu';

export default class RwbUiEngine {
  constructor(store, options = {}) {
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

    this.store = store;

    // Storage for Pixi sounds and active soundsPlaying.
    this.sounds = {};
    this.soundsPlaying = {};

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
        tooltips: null,
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
        movementPreviews: [],
        controllerFaces: [],
        diceFaces: [],
        playerPieces: [],
        tiles: [],
        tooltips: [],
      },
      // References to objects currently undergoing transition.
      transition: {},
    };

    PIXI.utils.skipHello();
    this.renderer = new PIXI.Application({
      width: 100, // dummy values
      height: 100,
      backgroundColor: 0x202020,
    });

    // Init modules.
    this.modules = {
      game: new RwbUiGame(this, store),
      menu: new RwbUiMenu(this, store),
    };

    this.showTooltipDebounced = debounce(this.showTooltip, 1800);

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

  showTooltip(element, params) {
    const tObj = deepGet(this.ui.objects, element);
    let xBaseline = tObj.x;
    let yBaseline = tObj.y;

    const tooltipText = new PIXI.Text(params.text || '');
    tooltipText.anchor.set(0.5, 0.5);
    tooltipText.style.fill = params.fill || 0x000000;
    tooltipText.style.fontSize = params.fontSize || 3 * this.options.du;

    const paddingX = 0.5 * tooltipText.width + 5 * this.options.du;
    const paddingY = 0.5 * tooltipText.height + 5 * this.options.du;
    xBaseline = Math.max(paddingX, Math.min(xBaseline, this.options.width - paddingX));
    yBaseline = Math.max(paddingY, Math.min(yBaseline, this.options.height - paddingY));
    tooltipText.position.set(xBaseline, yBaseline);

    const tooltipBg = new PIXI.Graphics();
    tooltipBg.beginFill(params.bgFill || 0xffffff);
    tooltipBg.lineStyle(0.5 * this.options.du, params.fill || 0x000000);
    tooltipBg.drawRect(0, 0, tooltipText.width + 8 * this.options.du, tooltipText.height + 8 * this.options.du);
    tooltipBg.endFill();
    const bgX = xBaseline - tooltipBg.width / 2;
    const bgY = yBaseline - tooltipBg.height / 2;
    tooltipBg.position.set(bgX, bgY);

    this.ui.containers.tooltips.addChild(tooltipBg);
    this.ui.containers.tooltips.addChild(tooltipText);
    this.ui.objects.tooltips.push(tooltipBg);
    this.ui.objects.tooltips.push(tooltipText);
  }

  attachTooltip(element, params) {
    this.showTooltipDebounced(element, params);
  }

  clearTooltips() {
    this.showTooltipDebounced.cancel();
    this.ui.objects.tooltips.forEach((tooltip) => {
      this.ui.containers.tooltips.removeChild(tooltip);
    });
    this.ui.objects.tooltips = [];
  }

  addTransition(element, params) {
    const tData = {
      cb: null,
      element, // String of subpath from ui.objects.
      translate: null,
      scale: null,
      rollDice: null,
      rotate: null,
      step: 0,
      steps: 100,
      ...params,
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

  createContainerRectangle(name, params) {
    const rect = new PIXI.Graphics();
    rect.beginFill(params.fill || 0x000000);
    rect.drawRect(0, 0, 1, 1);
    rect.endFill();
    this.ui.objects[params.container || 'base'][name] = rect;
    this.ui.containers[params.container || 'base'].addChild(rect);
  }

  createUiMessage(name, params = {}) {
    const defaultOptions = {
      fill: 0xf0f0f0,
      align: 'left',
      container: 'messages',
    };
    const extendedOptions = { ...defaultOptions, ...params };
    const message = new PIXI.Text(params.text || '');
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
        // Load textures
        new PIXI.Loader().add('rwb', './img/sprites.json').load((loader, resources) => {
          resolve(resources);
        });
      } catch (e) {
        reject(e);
      }
    }).then((res) => {
      console.log('Sprites loaded.');

      // noinspection JSUnresolvedVariable
      this.textures = res.rwb.textures;

      // Make multi-layer stage to ensure some sprites can display above others.
      ['base', 'map', 'sprites', 'controls', 'messages', 'menuPause', 'menuMain', 'tooltips'].forEach((container) => {
        this.ui.containers[container] = new PIXI.Container();
        this.renderer.stage.addChild(this.ui.containers[container]);
      });

      // Load sounds
      // const tempLoader = new PIXI.Loader();
      ['die', 'frightened', 'ka', 'start', 'wa', 'win'].forEach((sound) => {
        this.renderer.loader.add(sound, `./sounds/${sound}.mp3`);
      });
      return new Promise((resolve, reject) => {
        try {
          this.renderer.loader.load((loader, resources) => {
            resolve(resources);
          });
        } catch (e) {
          reject(e);
        }
      });
    }).then((res) => {
      console.log('Sounds loaded.');
      this.sounds = res;
      return true;
    }).then(() => {
      // Done loading.
      console.log('Initializing app.');

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

  playSound(name, loop = false) {
    if (!this.options.muted) {
      if (!Object.hasOwnProperty.call(this.soundsPlaying, name)) {
        const soundLoop = { ...this.sounds[name] };
        soundLoop.data.loop = loop;
        this.soundsPlaying[name] = soundLoop;
      }
      this.soundsPlaying[name].data.play();
    }
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
    if (this.store.get('gameStatus') === 0) {
      // In menu.
      this.ui.containers.base.visible = true;
      this.ui.containers.menuMain.visible = true;
    } else if (this.store.get('gamePaused')) {
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
      Object.entries({ translate: ['x', 'y'], scale: ['width', 'height'] }).forEach(([key, attrs]) => {
        const tDataProp = tData[key];
        if (tDataProp === null) {
          return;
        }
        attrs.forEach((attr) => {
          if (Object.prototype.hasOwnProperty.call(tDataProp, attr)) {
            tObj[attr] = tDataProp.from[attr] + tData.progress * (tDataProp[attr] - tDataProp.from[attr]);
          }
        });
      });

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

  stopSound(name) {
    if (Object.hasOwnProperty.call(this.soundsPlaying, name)) {
      this.soundsPlaying[name].data.stop();
    }
  }

  updateUiMessage(name, params) {
    const message = this.ui.objects.messages[name];
    if (Object.prototype.hasOwnProperty.call(params, 'align')) {
      message.style.align = params.align;
      if (params.align === 'left') {
        message.anchor.set(0, 0.5);
      } else if (params.align === 'right') {
        message.anchor.set(1.0, 0.5);
      } else {
        message.anchor.set(0.5, 0.5);
      }
    }
    if (Object.prototype.hasOwnProperty.call(params, 'fill')) {
      message.style.fill = params.fill;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'fontSize')) {
      message.style.fontSize = params.fontSize;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'text')) {
      message.text = params.text;
    }
    if (Object.prototype.hasOwnProperty.call(params, 'x') && Object.prototype.hasOwnProperty.call(params, 'y')) {
      message.position.set(params.x, params.y);
    }
  }
}
