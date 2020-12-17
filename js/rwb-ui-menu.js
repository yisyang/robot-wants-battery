import * as PIXI from 'pixi.js';

export default class RwbUiMenu {
  constructor(engine, gameState) {
    this.engine = engine;
    this.gameState = gameState;

    this.options = {
      width: null,
      height: null,
      maxPlayersCount: 4, // Hardcoded.
    };

    // Local view data.
    this.data = {
      menu: {
        mapDifficulty: this.gameState.get('mapDifficulty'),
        playerController: [1, 0, 0, 0],
      },
    };
  }

  computeMenuLayout() {
    this.options.width = this.engine.options.width;
    this.options.height = this.engine.options.height;
    if (this.options.height > this.options.width) {
      this.options.my = (this.options.height - this.options.width) / 2;
    } else {
      this.options.my = 0;
    }

    this.options.menuFontSize = 4 * this.engine.options.du;
    this.options.titleFontSize = 8 * this.engine.options.du;
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
    for (let i = 0; i < this.options.maxPlayersCount; i++) {
      const texture = `face-${this.data.menu.playerController[i]}`;
      const btn = new PIXI.Sprite(this.engine.textures[texture]);
      this.engine.ui.objects.controllerFaces.push(btn);
      this.engine.ui.containers.menuMain.addChild(btn);
    }

    // Map difficulty.
    const btnDifficulty = new PIXI.Sprite(this.engine.textures[`difficulty-${this.data.menu.mapDifficulty}`]);
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
      this.engine.dispatchEvent(new CustomEvent('newGame', { detail: this.data.menu }));
    });
  }

  refreshDisplay() {
    this.computeMenuLayout();

    // Always reposition menu.
    this.repositionMenu();
  }

  repositionMenu() {
    const { my } = this.options;
    this.engine.ui.objects.base.menuBase.width = this.options.width;
    this.engine.ui.objects.base.menuBase.height = this.options.height;
    this.engine.ui.objects.base.menuOptionsArea.width = this.options.width;
    this.engine.ui.objects.base.menuOptionsArea.height = 8.125 * this.options.titleFontSize;
    this.engine.ui.objects.base.menuOptionsArea.y = my + 2.25 * this.options.titleFontSize;

    this.engine.updateUiMessage('title', {
      text: 'Robot Wants Battery',
      fontSize: this.options.titleFontSize,
      x: this.options.width / 2,
      y: my + this.options.titleFontSize,
    });

    this.engine.updateUiMessage('menuDifficulty', {
      text: 'Map Difficulty',
      fontSize: this.options.menuFontSize,
      x: this.options.width / 2,
      y: my + 3 * this.options.titleFontSize,
    });

    this.engine.ui.objects.menu.mapDifficulty.width = 1.5 * this.options.titleFontSize;
    this.engine.ui.objects.menu.mapDifficulty.height = 1.5 * this.options.titleFontSize;
    this.engine.ui.objects.menu.mapDifficulty.position.set(
      this.options.width / 2,
      my + 4.5 * this.options.titleFontSize,
    );

    this.engine.updateUiMessage('menuPlayers', {
      text: 'Players',
      fontSize: this.options.menuFontSize,
      x: this.options.width / 2,
      y: my + 7 * this.options.titleFontSize,
    });

    for (let i = 0; i < this.options.maxPlayersCount; i++) {
      this.engine.ui.objects.controllerFaces[i].width = 1.5 * this.options.titleFontSize;
      this.engine.ui.objects.controllerFaces[i].height = 1.5 * this.options.titleFontSize;
      this.engine.ui.objects.controllerFaces[i].position.set(
        (i + 1) / 5 * this.options.width,
        my + 8.5 * this.options.titleFontSize,
      );
    }

    // Difficulty and player buttons.
    for (let i = 0; i < 8; i++) {
      this.engine.ui.objects.menu.controls[i].width = 0.5 * this.options.titleFontSize;
      this.engine.ui.objects.menu.controls[i].height = 0.5 * this.options.titleFontSize;
      let x;
      let y;
      const xAdjustment = (i % 2 === 0 ? -1 : 1) * 0.45 * this.options.titleFontSize;
      if (i < 2) {
        // Difficulty buttons.
        x = this.options.width / 2 + xAdjustment;
        y = my + 5.75 * this.options.titleFontSize;
      } else {
        // Player buttons.
        x = Math.floor(i / 2 + 1) / 5 * this.options.width + xAdjustment;
        y = my + 9.75 * this.options.titleFontSize;
      }
      this.engine.ui.objects.menu.controls[i].position.set(x, y);
    }

    this.engine.ui.objects.menu.btnStartGame.width = 3.5 * this.options.titleFontSize;
    this.engine.ui.objects.menu.btnStartGame.height = 3.5 * this.options.titleFontSize / 3.2;
    this.engine.ui.objects.menu.btnStartGame.position.set(
      this.options.width / 2,
      my + 11.5 * this.options.titleFontSize,
    );
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
    this.engine.ui.objects.controllerFaces[index].texture = this.engine.textures[`face-${newController}`];

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
    this.engine.ui.objects.menu.mapDifficulty.texture = this.engine.textures[`difficulty-${newDifficulty}`];
  }

  updateMenuPlayerVisibility() {
    // Hide faces and arrows of all None players but the first.
    let indexFirstNone = this.options.maxPlayersCount;
    for (let i = 1; i < this.options.maxPlayersCount; i++) {
      const controller = this.data.menu.playerController[i];
      let visible = true;
      if (controller === 0) {
        if (i <= indexFirstNone) {
          indexFirstNone = i;
          // Also assign all future controllers to 0.
          for (let j = i + 1; j < this.options.maxPlayersCount; j++) {
            this.data.menu.playerController[j] = 0;
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
