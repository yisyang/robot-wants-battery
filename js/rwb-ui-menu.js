import * as PIXI from 'pixi.js';

// Local view data.
const data = {
  width: null,
  height: null,
  maxPlayersCount: 4, // Hardcoded.
  playerController: [1, 0, 0, 0],
};

export default class RwbUiMenu {
  constructor(engine, store) {
    this.engine = engine;
    this.store = store;

    data.mapDifficulty = this.store.get('mapDifficulty');
  }

  computeMenuLayout() {
    data.width = this.engine.options.width;
    data.height = this.engine.options.height;
    if (data.height > data.width) {
      data.my = (data.height - data.width) / 2;
    } else {
      data.my = 0;
    }

    data.menuFontSize = 4 * this.engine.options.du;
    data.titleFontSize = 8 * this.engine.options.du;
  }

  init() {
    this.engine.createContainerRectangle('menuBase', { fill: 0x3090ff });
    this.engine.createContainerRectangle('menuOptionsArea', { fill: 0x303030 });

    // Menu title.
    this.engine.createUiMessage('title', { container: 'menuMain', fill: 0xffffff, align: 'center' });

    // Submenu players.
    this.engine.createUiMessage('menuPlayers', { container: 'menuMain', fill: 0xffffff, align: 'center' });

    // Menu title.
    this.engine.createUiMessage('menuDifficulty', { container: 'menuMain', fill: 0xffffff, align: 'center' });

    // Controller faces.
    for (let i = 0; i < data.maxPlayersCount; i++) {
      const texture = `face-${data.playerController[i]}`;
      const btn = new PIXI.Sprite(this.engine.textures[texture]);
      this.engine.ui.objects.controllerFaces.push(btn);
      this.engine.ui.containers.menuMain.addChild(btn);
    }

    // Map difficulty.
    const btnDifficulty = new PIXI.Sprite(this.engine.textures[`difficulty-${data.mapDifficulty}`]);
    this.engine.ui.objects.menu.mapDifficulty = btnDifficulty;
    this.engine.ui.containers.menuMain.addChild(btnDifficulty);

    // Add 8 arrow buttons for swapping map difficulty and players 2-4 controller.
    for (let i = 0; i < 8; i++) {
      const texture = i % 2 === 0 ? 'btn-left' : 'btn-right';
      const btn = new PIXI.Sprite(this.engine.textures[texture]);
      btn.interactive = true;
      this.engine.ui.objects.menu.controls.push(btn);
      this.engine.ui.containers.menuMain.addChild(btn);
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
    const btnStart = new PIXI.Sprite(this.engine.textures['btn-start']);
    btnStart.interactive = true;
    this.engine.ui.objects.menu.btnStartGame = btnStart;
    this.engine.ui.containers.menuMain.addChild(btnStart);
    btnStart.on('click', () => {
      this.engine.dispatchEvent(new CustomEvent('newGame', { detail: data }));
    });
  }

  refreshDisplay() {
    this.computeMenuLayout();

    // Always reposition menu.
    this.repositionMenu();
  }

  repositionMenu() {
    this.engine.ui.objects.base.menuBase.width = data.width;
    this.engine.ui.objects.base.menuBase.height = data.height;
    this.engine.ui.objects.base.menuOptionsArea.width = data.width;
    this.engine.ui.objects.base.menuOptionsArea.height = 8.125 * data.titleFontSize;
    this.engine.ui.objects.base.menuOptionsArea.y = data.my + 2.25 * data.titleFontSize;

    this.engine.updateUiMessage('title', {
      text: 'Robot Wants Battery',
      fontSize: data.titleFontSize,
      x: data.width / 2,
      y: data.my + data.titleFontSize,
    });

    this.engine.updateUiMessage('menuDifficulty', {
      text: 'Map Difficulty',
      fontSize: data.menuFontSize,
      x: data.width / 2,
      y: data.my + 3 * data.titleFontSize,
    });

    this.engine.ui.objects.menu.mapDifficulty.width = 1.5 * data.titleFontSize;
    this.engine.ui.objects.menu.mapDifficulty.height = 1.5 * data.titleFontSize;
    this.engine.ui.objects.menu.mapDifficulty.position.set(
      data.width / 2,
      data.my + 4.5 * data.titleFontSize,
    );

    this.engine.updateUiMessage('menuPlayers', {
      text: 'Players',
      fontSize: data.menuFontSize,
      x: data.width / 2,
      y: data.my + 7 * data.titleFontSize,
    });

    for (let i = 0; i < data.maxPlayersCount; i++) {
      this.engine.ui.objects.controllerFaces[i].width = 1.5 * data.titleFontSize;
      this.engine.ui.objects.controllerFaces[i].height = 1.5 * data.titleFontSize;
      this.engine.ui.objects.controllerFaces[i].position.set(
        (i + 1) / 5 * data.width,
        data.my + 8.5 * data.titleFontSize,
      );
    }

    // Difficulty and player buttons.
    for (let i = 0; i < 8; i++) {
      this.engine.ui.objects.menu.controls[i].width = 0.5 * data.titleFontSize;
      this.engine.ui.objects.menu.controls[i].height = 0.5 * data.titleFontSize;
      let x;
      let y;
      const xAdjustment = (i % 2 === 0 ? -1 : 1) * 0.45 * data.titleFontSize;
      if (i < 2) {
        // Difficulty buttons.
        x = data.width / 2 + xAdjustment;
        y = data.my + 5.75 * data.titleFontSize;
      } else {
        // Player buttons.
        x = Math.floor(i / 2 + 1) / 5 * data.width + xAdjustment;
        y = data.my + 9.75 * data.titleFontSize;
      }
      this.engine.ui.objects.menu.controls[i].position.set(x, y);
    }

    this.engine.ui.objects.menu.btnStartGame.width = 3.5 * data.titleFontSize;
    this.engine.ui.objects.menu.btnStartGame.height = 3.5 * data.titleFontSize / 3.2;
    this.engine.ui.objects.menu.btnStartGame.position.set(
      data.width / 2,
      data.my + 11.5 * data.titleFontSize,
    );
  }

  togglePlayer(index, isPrevious = false) {
    // If previous index is empty, then player cannot be toggled.
    // Assume allowed indices are consecutive integers.
    if (data.playerController[index - 1] === 0) {
      return;
    }
    let newController = data.playerController[index] + (isPrevious ? -1 : 1);
    const controllersAllowed = this.store.get('gameOptions.controllersAllowed');
    if (newController < 0) {
      newController = controllersAllowed[controllersAllowed.length - 1];
    }
    if (newController >= controllersAllowed.length) {
      newController = 0;
    }
    data.playerController[index] = newController;
    this.engine.ui.objects.controllerFaces[index].texture = this.engine.textures[`face-${newController}`];

    this.updateMenuPlayerVisibility();
  }

  toggleMapDifficulty(isPrevious = false) {
    let newDifficulty = data.mapDifficulty + (isPrevious ? -1 : 1);
    if (newDifficulty < 0) {
      newDifficulty = 3;
    }
    if (newDifficulty > 3) {
      newDifficulty = 0;
    }
    data.mapDifficulty = newDifficulty;
    this.engine.ui.objects.menu.mapDifficulty.texture = this.engine.textures[`difficulty-${newDifficulty}`];
  }

  updateMenuPlayerVisibility() {
    // Hide faces and arrows of all None players but the first.
    let indexFirstNone = data.maxPlayersCount;
    for (let i = 1; i < data.maxPlayersCount; i++) {
      const controller = data.playerController[i];
      let visible = true;
      if (controller === 0) {
        if (i <= indexFirstNone) {
          indexFirstNone = i;
          // Also assign all future controllers to 0.
          for (let j = i + 1; j < data.maxPlayersCount; j++) {
            data.playerController[j] = 0;
            this.engine.ui.objects.controllerFaces[j].texture = this.engine.textures['face-0'];
          }
        } else {
          visible = false;
        }
      }
      this.engine.ui.objects.controllerFaces[i].visible = visible;
      this.engine.ui.objects.menu.controls[i * 2].visible = visible;
      this.engine.ui.objects.menu.controls[i * 2 + 1].visible = visible;
    }
  }
}
