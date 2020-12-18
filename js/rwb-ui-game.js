import * as PIXI from 'pixi.js';

// Local view data.
const data = {
  activeKeyboardDice: 0,
  canMove: false,
  movement: {
    start: null,
    moves: [],
  },
};

export default class RwbUiGame {
  constructor(engine, store) {
    this.engine = engine;
    this.store = store;

    this.options = {
      width: null,
      height: null,
      board: {},
      controls: {},
    };
  }

  clearGameMap() {
    // Clear map and sprites containers.
    this.engine.ui.objects.tiles.forEach((row) => {
      row.forEach((tile) => {
        this.engine.ui.containers.map.removeChild(tile);
      });
    });
    this.engine.ui.objects.tiles = [];
    this.engine.ui.objects.playerPieces.forEach((pp) => {
      this.engine.ui.containers.sprites.removeChild(pp);
    });
    this.engine.ui.objects.playerPieces = [];

    // Clear messages.
    for (const message of Object.values(this.engine.ui.objects.messages)) {
      if (message !== null) {
        message.text = '';
      }
    }
  }

  clearMovement(diceIndex = null) {
    // Remove preview overlay tiles.
    [0, 1].forEach((key) => {
      // noinspection JSIncompatibleTypesComparison
      if (diceIndex === null || diceIndex === key) {
        this.clearMovementPreviews(key);
        // Reset local movement view data.
        data.movement.moves[key] = {
          alive: false,
          diceIndex: null,
          direction: null,
          flying: false,
          tilesCrossed: [],
          target: [],
        };
      }
    });

    // Reset local starting position data.
    const currentActivePlayer = this.store.get('currentActivePlayer');
    const { x, y } = this.store.get(`players[${currentActivePlayer}]`);
    data.movement.start = [x, y];
  }

  clearMovementPreviews(moveIndex) {
    if (Object.hasOwnProperty.call(this.engine.ui.objects.movementPreviews, moveIndex)) {
      // Remove UI preview.
      this.engine.ui.objects.movementPreviews[moveIndex].forEach((tile) => {
        this.engine.ui.containers.map.removeChild(tile);
      });
    }
    this.engine.ui.objects.movementPreviews[moveIndex] = [];

    if (moveIndex === 0) {
      this.engine.ui.objects.controls.btnCancel.alpha = 0.3;
    }
    this.engine.ui.objects.controls.btnConfirm.alpha = 0.3;
  }

  computeBaseGridSize() {
    const gridSizePxX = this.engine.options.width / (this.engine.options.gridCountX + 2);
    // Additional 10% height reserved for turn/score display.
    const gridSizePxY = this.engine.options.height / (this.engine.options.gridCountY + 2) / 1.1;
    const gridSizePxBeforeReserveMin = Math.floor(Math.min(gridSizePxX, gridSizePxY));
    // Reserve 33% width or height for other UI controls.
    const gridSizePxAfterReserveMax = Math.floor(Math.max(gridSizePxX, gridSizePxY) / 1.33);
    const gridSizePx = Math.min(gridSizePxBeforeReserveMin, gridSizePxAfterReserveMax);
    if (gridSizePx < 12) {
      throw Error('Error: Grid size too small to be playable! Please increase grid width/height.');
    }
    return gridSizePx;
  }

  computeGameLayout() {
    this.options.gridSizePx = this.computeBaseGridSize();

    // Analyze container AR vs board AR, and determine if the rest of UI should be portrait of landscape.
    const containerAR = this.engine.options.width / this.engine.options.height;
    // Additional 10% height reserved for turn/score display on board area.
    const boardAR = this.engine.options.gridCountX / this.engine.options.gridCountY / 1.1;
    this.options.board.width = this.options.gridSizePx * this.engine.options.gridCountX;
    this.options.board.height = this.options.gridSizePx * this.engine.options.gridCountY;

    this.options.board.pt = Math.floor(
      (1 + 0.1 * this.engine.options.gridCountY) * this.options.gridSizePx,
    );
    if (containerAR > boardAR) {
      this.options.displayMode = 'landscape';
      this.options.mx = Math.max(0, (this.engine.options.width - 1.4 * this.engine.options.height) / 2);
      this.options.my = 0;
      this.options.board.px = this.options.gridSizePx;
      this.options.board.widthWP = this.options.board.width
        + 2 * this.options.board.px;
      this.options.board.heightWP = this.engine.options.height;
      this.options.controls.x = this.options.mx + this.options.board.widthWP;
      this.options.controls.y = this.options.my;
      this.options.controls.width = this.engine.options.width
        - this.options.controls.x - this.options.mx;
      this.options.controls.height = this.options.board.heightWP;
    } else {
      this.options.displayMode = 'portrait';
      this.options.mx = 0;
      this.options.my = Math.max(0, (this.engine.options.height - 1.4 * this.engine.options.width) / 2);
      this.options.board.px = Math.floor(
        (this.engine.options.width - this.options.board.width) / 2,
      );
      this.options.board.widthWP = this.engine.options.width;
      this.options.board.heightWP = this.options.board.height
        + this.options.board.pt + this.options.gridSizePx;
      this.options.controls.x = this.options.mx;
      this.options.controls.y = this.options.my + this.options.board.heightWP;
      this.options.controls.width = this.options.board.widthWP;
      this.options.controls.height = this.engine.options.height
        - this.options.controls.y - this.options.my;
    }

    this.options.controls.du = 1 / 100 * Math.min(
      this.options.controls.width, this.options.controls.height,
    );

    this.options.infoTextSize = Math.floor(
      0.035 * this.engine.options.gridCountY * this.options.gridSizePx,
    );
  }

  computePlannedMovementData(moveIndex, options) {
    let diceValue = this.store.get(`diceValue[${options.dice}]`);

    // Determine starting location.
    let startingLocation;
    let flying = false;
    if (moveIndex === 0) {
      startingLocation = data.movement.start;
    } else if (options.direction === data.movement.moves[0].direction) {
      // Continued move (fly).
      startingLocation = data.movement.start;
      diceValue += this.store.get(`diceValue[${1 - options.dice}]`);
      flying = true;
    } else {
      startingLocation = data.movement.moves[0].target;
    }

    // Convert movement into x/y increment.
    const axis = (options.direction === 'Left' || options.direction === 'Right') ? 0 : 1;
    const increment = (options.direction === 'Down' || options.direction === 'Right') ? 1 : -1;

    // Check if movement is legal.
    const mapTilesData = this.store.get('mapTiles');
    let drowned = false;
    let oob = false;
    let [i, j] = startingLocation;
    const tilesCrossed = [[i, j]];
    for (let step = 1; step <= diceValue; step++) {
      if (axis === 0) {
        i += increment;
      } else {
        j += increment;
      }
      if (i < 0 || j < 0 || i >= this.engine.options.gridCountX || j >= this.engine.options.gridCountY) {
        // Illegal move outside of map.
        oob = true;
        break;
      }
      if (mapTilesData[i][j].type === 'water') {
        if (!flying || step === diceValue) {
          // Walked into water OR flying but landed in water.
          drowned = true;
        }
      }
      tilesCrossed.push([i, j]);
    }

    // Save local movement data.
    data.movement.moves[moveIndex] = {
      alive: !(oob || drowned),
      diceIndex: oob ? -1 : options.dice, // Hack: storing invalid diceIndex allows illegal moves to be overwritten.
      direction: options.direction,
      flying,
      tilesCrossed,
      target: oob ? [] : tilesCrossed[tilesCrossed.length - 1],
    };
  }

  countPlayersAtPlayerLocation(i) {
    const playersData = this.store.get('players');
    const { x, y } = playersData[i];
    return playersData.map((e) => ((e.x === x && e.y === y) ? 1 : 0)).reduce((a, b) => a + b);
  }

  /**
   * @param mapTilesData Map tile info as 2D matrix with .type property
   */
  createGameTiles(mapTilesData) {
    this.engine.ui.objects.tiles = [];
    for (let i = 0; i < this.engine.options.gridCountX; i++) {
      this.engine.ui.objects.tiles[i] = [];
      for (let j = 0; j < this.engine.options.gridCountY; j++) {
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
        const tile = new PIXI.Sprite(this.engine.textures[textureName]);
        this.engine.ui.objects.tiles[i][j] = tile;
        this.engine.ui.containers.map.addChild(tile);
      }
    }
  }

  /**
   * @param {Number} playersCount Number of players
   */
  createPlayerPieces(playersCount) {
    for (let i = 0; i < playersCount; i++) {
      const textureName = `p${String(i + 1)}`;
      const piece = new PIXI.Sprite(this.engine.textures[textureName]);
      this.engine.ui.objects.playerPieces[i] = piece;
      this.engine.ui.containers.sprites.addChild(piece);
    }
  }

  drawMovementPreview(moveIndex) {
    const moveData = data.movement.moves[moveIndex];
    const color = (moveData.alive ? 0x00ff00 : 0xff0000);
    const marginX = Math.floor(this.options.mx + this.options.board.px);
    const marginY = Math.floor(this.options.my + this.options.board.pt);
    const [i0, j0] = moveData.tilesCrossed[0];
    moveData.tilesCrossed.forEach(([i, j]) => {
      const tile = new PIXI.Graphics();
      const offsetX = marginX + i * this.options.gridSizePx;
      const offsetY = marginY + j * this.options.gridSizePx;
      tile.beginFill((i === i0 && j === j0) ? 0xffff00 : color);
      tile.drawRect(0, 0, this.options.gridSizePx, this.options.gridSizePx);
      tile.endFill();
      tile.alpha = 0.5;
      tile.position.set(offsetX, offsetY);
      this.engine.ui.objects.movementPreviews[moveIndex].push(tile);
      this.engine.ui.containers.map.addChild(tile);
    });

    this.engine.ui.objects.controls.btnCancel.alpha = 1;
    if (moveIndex === 1) {
      this.engine.ui.objects.controls.btnConfirm.alpha = 1;
    }
  }

  drawMovementPreviews() {
    // Start by clearing the existing previews.
    this.clearMovementPreviews(0);
    this.clearMovementPreviews(1);
    // Redraw movement 0 if available and if we are not flying.
    if (data.movement.moves[0].direction !== null && !data.movement.moves[1].flying) {
      this.drawMovementPreview(0);
    }
    // Always draw movement 1 if direction is available.
    if (data.movement.moves[1].direction !== null) {
      this.drawMovementPreview(1);
    }
  }

  enableDiceButtons(diceIndex) {
    ['Up', 'Down', 'Left', 'Right'].forEach((direction) => {
      const btn = this.engine.ui.objects[`btnDice${diceIndex}${direction}`];
      btn.alpha = 1;
      data.canMove = true;
    });
  }

  highlightActiveKeyboardDice() {
    [0, 1].forEach((diceIndex) => {
      this.engine.ui.objects.diceFaces[diceIndex].tint = (diceIndex === data.activeKeyboardDice ? 0xffff00 : 0xffffff);
    });
  }

  /**
   * Initialize game UI.
   */
  init() {
    this.initGameControls();
    this.initKeyboardEvents();
    this.initUiMessages();

    // Initialize local movement data for rendering.
    [0, 1].forEach((key) => {
      data.movement.moves[key] = {
        alive: false,
        diceIndex: null,
        direction: null,
        flying: false,
        tilesCrossed: [],
        target: [],
      };
    });

    this.engine.addEventListener('planMove', (e) => {
      // Start planning.
      this.planMove(e.detail);
    });

    this.engine.addEventListener('cancel', () => {
      // Clear planned movement.
      this.clearMovement();
    });

    this.engine.addEventListener('confirm', () => {
      // Confirm movement.
      this.moveRobot();
    });
  }

  initGameControls() {
    // Draw base board.
    this.engine.createContainerRectangle('board', { fill: 0x3090ff, container: 'map' });
    this.engine.createContainerRectangle('controlsArea', { fill: 0x303030, container: 'map' });

    // Init pause menu buttons and game control buttons.
    Object.entries({
      menuPause: ['Resume', 'Abandon'],
      controls: ['Pause', 'Cancel', 'Confirm'],
    }).forEach(([key, btnTexts]) => {
      btnTexts.forEach((btnText) => {
        const btn = new PIXI.Sprite(this.engine.textures[`btn-${btnText.toLowerCase()}`]);
        btn.interactive = true;
        btn.on('click', () => {
          this.engine.dispatchEvent(new CustomEvent(btnText.toLowerCase(), {}));
        });
        this.engine.ui.objects[key][`btn${btnText}`] = btn;
        this.engine.ui.containers[key].addChild(btn);
      });
    });

    // Dice faces.
    // Two dice, init at 0.
    [0, 1].forEach((i) => {
      const diceFace = new PIXI.Sprite(this.engine.textures['dice-face-0']);
      this.engine.ui.objects.diceFaces.push(diceFace);
      this.engine.ui.containers.controls.addChild(diceFace);

      // Dice controls.
      // Two sets, one for each dice.
      ['Up', 'Down', 'Left', 'Right'].forEach((direction) => {
        const btn = new PIXI.Sprite(this.engine.textures[`btn-${direction.toLowerCase()}`]);
        btn.interactive = true;
        btn.alpha = 0.3;
        this.engine.ui.objects[`btnDice${i}${direction}`] = btn;
        this.engine.ui.containers.controls.addChild(btn);
        btn.on('click', () => {
          if (data.canMove) {
            this.engine.dispatchEvent(new CustomEvent('planMove', {
              detail: {
                dice: i,
                direction,
              },
            }));
          }
        });
      });
    });
  }

  initKeyboardEvents() {
    // Register window keyboard events.
    window.addEventListener('keydown', (e) => {
      let direction = null;
      switch (e.code) {
        case 'Numpad8':
        case 'KeyW':
        case 'ArrowUp':
          direction = 'Up';
          break;
        case 'Numpad4':
        case 'KeyA':
        case 'ArrowLeft':
          direction = 'Left';
          break;
        case 'Numpad2':
        case 'KeyS':
        case 'ArrowDown':
          direction = 'Down';
          break;
        case 'Numpad6':
        case 'KeyD':
        case 'ArrowRight':
          direction = 'Right';
          break;
        case 'Numpad5':
        case 'KeyX':
          // Switch dice.
          data.activeKeyboardDice = (data.activeKeyboardDice === 1 ? 0 : 1);
          break;
        case 'Numpad0':
        case 'KeyC':
          // Cancel.
          this.engine.dispatchEvent(new CustomEvent('cancel', {}));
          data.activeKeyboardDice = 0;
          break;
        case 'NumpadEnter':
        case 'KeyZ':
          // Confirm.
          this.engine.dispatchEvent(new CustomEvent('confirm', {}));
          return;
        default:
          return;
      }
      if (direction !== null && data.canMove) {
        // Save current active dice and emit directional event.
        data.activeKeyboardDice = (data.activeKeyboardDice === 1 ? 1 : 0);
        this.engine.dispatchEvent(new CustomEvent('planMove', {
          detail: {
            dice: data.activeKeyboardDice,
            direction,
          },
        }));
      } else {
        this.highlightActiveKeyboardDice();
      }
    });
  }

  initUiMessages() {
    this.engine.createUiMessage('mapDifficulty');
    const msg = this.engine.createUiMessage('mapSeed');
    msg.interactive = true;
    msg.on('click', () => {
      this.engine.dispatchEvent(new CustomEvent('seedNewGame', {}));
    });
    this.engine.createUiMessage('gameTurn', { align: 'center' });
    this.engine.createUiMessage('playerTurn', { align: 'center' });
    this.engine.createUiMessage('gameScore', { align: 'right' });
    this.engine.createUiMessage('hiScore', { align: 'right' });
  }

  planMove(options) {
    if (this.store.get(`diceValue[${options.dice}]`) === 0) {
      return;
    }

    // In general, we'll be modifying the first move.
    let moveIndex = 0;
    // To move onto second move, the first move must have been made by another dice.
    if (data.movement.moves[0].diceIndex === (1 - options.dice)) {
      // And player needs to be alive OR flying after the first move.
      if (data.movement.moves[0].alive || data.movement.moves[0].direction === options.direction) {
        // And player must not have already tried the same direction and ended with death.
        if (data.movement.moves[1].direction !== options.direction) {
          // Trying a new direction.
          moveIndex = 1;
        } else if (data.movement.moves[1].alive) {
          // Trying the same direction and still alive, no change needed.
          return;
        }
      }
    }

    // If changing first movement, delete second movement data.
    if (moveIndex === 0) {
      this.clearMovement(1);
    }

    this.computePlannedMovementData(moveIndex, options);
    this.drawMovementPreviews();

    // In addition, automatically toggle other dice as next activeKeyboardDice on valid moves.
    if (data.activeKeyboardDice !== null) {
      if (moveIndex === 0 && data.movement.moves[0].alive) {
        data.activeKeyboardDice = 1 - data.activeKeyboardDice;
        this.highlightActiveKeyboardDice();
      }
    }
  }

  moveRobot() {
    if (data.movement.moves[1].direction === null) {
      return;
    }

    // Remove keyboard highlighting.
    data.activeKeyboardDice = null;
    this.highlightActiveKeyboardDice();


    // TODO: Move player piece slowly, 1 square at a time, and check for death.
    // Rotate on death.
    // dispatch playerLost on death
    // dispatch diceMoved on move end
    // dispatch playerMoved on both dice moved
    // this.uiEngine.modules.game.moveRobotStep()

    // If player is alive, update player position to target position.
    const [x, y] = data.movement.moves[1].target;
    this.engine.dispatchEvent(new CustomEvent('turnEnded', {
      detail: {
        location: { x, y },
        alive: data.movement.moves[1].alive,
      },
    }));
  }

  nextTurn() {
    const currentActivePlayer = this.store.get('currentActivePlayer');
    const currentTurn = this.store.get('currentTurn');

    this.engine.updateUiMessage('gameTurn', { text: `Turn: ${currentTurn}` });
    this.engine.updateUiMessage('gameScore', { text: `Score: ${this.store.get('currentScore')}` });

    const playerName = this.store.get(`players.${currentActivePlayer}.name`);
    this.engine.updateUiMessage('playerTurn', {
      text: `${playerName}'s turn.`,
      fill: this.store.get('gameOptions.playerColors')[currentActivePlayer],
      fontSize: 1.2 * this.options.gridSizePx,
      x: this.options.mx + this.options.board.widthWP / 2,
      y: this.options.my + this.options.board.heightWP / 2,
    });
    this.engine.addTransition('messages.playerTurn', {
      translate: { y: this.options.my + 4 * this.options.infoTextSize },
      cb: () => {
        this.engine.updateUiMessage('playerTurn', {
          x: this.options.mx + this.options.board.widthWP / 2,
          y: this.options.my + 2.5 * this.options.infoTextSize,
          fontSize: this.options.infoTextSize,
        });
      },
    });

    this.repositionPlayerPieces();
    this.clearMovement();
    data.canMove = false;
    this.engine.ui.objects.controls.btnCancel.alpha = 0.3;
    this.engine.ui.objects.controls.btnConfirm.alpha = 0.3;
    [0, 1].forEach((i) => {
      this.engine.addTransition(`diceFaces[${i}]`, {
        rollDice: true,
        steps: 100,
        cb: () => {
          const diceValue = this.store.get(`diceValue[${i}]`);
          this.engine.ui.objects.diceFaces[i].texture = this.engine.textures[`dice-face-${diceValue}`];

          this.enableDiceButtons(i);
        },
      });
    });
  }

  refreshDisplay() {
    this.computeGameLayout();

    // Resize game board.
    this.engine.ui.objects.map.board.x = this.options.mx;
    this.engine.ui.objects.map.board.y = this.options.my;
    this.engine.ui.objects.map.board.width = this.options.board.widthWP;
    this.engine.ui.objects.map.board.height = this.options.board.heightWP;

    // In-game.
    if (this.store.get('gameStatus') > 0) {
      // Reposition various messages.
      this.repositionGameMessages();

      // Reposition map tiles.
      this.repositionMapTiles();

      // Reposition player pieces.
      this.repositionPlayerPieces();

      // Reposition controls.
      this.repositionGameControls();

      // Re-draw
      this.drawMovementPreviews();
    }
  }

  repositionGameControls() {
    // Update pause menu.
    ['Resume', 'Abandon'].forEach((btnText) => {
      this.engine.ui.objects.menuPause[`btn${btnText}`].width = 32 * this.engine.options.du;
      this.engine.ui.objects.menuPause[`btn${btnText}`].height = 10 * this.engine.options.du;
    });
    this.engine.ui.objects.menuPause.btnResume.position.set(
      this.engine.options.width / 2, 0.4 * this.engine.options.height,
    );
    this.engine.ui.objects.menuPause.btnAbandon.position.set(
      this.engine.options.width / 2, 0.6 * this.engine.options.height,
    );

    // Update controls area.
    this.engine.ui.objects.map.controlsArea.position.set(
      this.options.controls.x,
      this.options.controls.y,
    );
    this.engine.ui.objects.map.controlsArea.width = this.options.controls.width;
    this.engine.ui.objects.map.controlsArea.height = this.options.controls.height;

    // Pause button.
    this.engine.ui.objects.controls.btnPause.width = 15 * this.options.controls.du;
    this.engine.ui.objects.controls.btnPause.height = 15 * this.options.controls.du;
    this.engine.ui.objects.controls.btnPause.position.set(
      this.options.controls.x + this.options.controls.width - 10 * this.options.controls.du,
      this.options.controls.y + 10 * this.options.controls.du,
    );

    const btnTexts = ['Cancel', 'Confirm'];
    [0, 1].forEach((i) => {
      const btn = this.engine.ui.objects.controls[`btn${btnTexts[i]}`];
      btn.width = 25 * this.options.controls.du;
      btn.height = 25 * this.options.controls.du;
      if (this.options.displayMode === 'landscape') {
        // Landscape.
        btn.position.set(
          this.options.mx
          + this.options.board.widthWP
          + (30 + i * 40) * this.options.controls.du,
          0.85 * this.options.controls.height,
        );
      } else {
        // Portrait.
        btn.position.set(
          0.85 * this.options.controls.width,
          this.options.my
          + this.options.board.heightWP
          + (30 + i * 40) * this.options.controls.du,
        );
      }
    });

    // Dice faces.
    const baselineX = this.options.mx
      + this.options.board.widthWP + 50 * this.options.controls.du;
    const baselineY = this.options.my
      + this.options.board.heightWP + 50 * this.options.controls.du;
    const diceFacePos = [
      [baselineX, baselineY],
      [baselineX, baselineY],
    ];
    if (this.options.displayMode === 'landscape') {
      // Landscape.
      diceFacePos[0][1] = 0.2 * this.options.controls.height;
      diceFacePos[1][1] = 0.55 * this.options.controls.height;
    } else {
      // Portrait.
      diceFacePos[0][0] = 0.2 * this.options.controls.width;
      diceFacePos[1][0] = 0.55 * this.options.controls.width;
    }
    // Two dice, init at 0.
    [0, 1].forEach((i) => {
      this.engine.ui.objects.diceFaces[i].width = 25 * this.options.controls.du;
      this.engine.ui.objects.diceFaces[i].height = 25 * this.options.controls.du;
      this.engine.ui.objects.diceFaces[i].position.set(diceFacePos[i][0], diceFacePos[i][1]);

      // Dice controls.
      [
        ['Up', 0, -1],
        ['Down', 0, 1],
        ['Left', -1, 0],
        ['Right', 1, 0],
      ].forEach(([dir, x, y]) => {
        const btn = this.engine.ui.objects[`btnDice${i}${dir}`];
        btn.width = 12 * this.options.controls.du;
        btn.height = 12 * this.options.controls.du;
        btn.position.set(
          diceFacePos[i][0] + 25 * x * this.options.controls.du,
          diceFacePos[i][1] + 25 * y * this.options.controls.du,
        );
      });
    });
  }

  repositionGameMessages() {
    // Update game status messages at top.
    const left = this.options.mx + this.options.infoTextSize;
    const center = this.options.mx + this.options.board.widthWP / 2;
    const right = this.options.mx + this.options.board.widthWP - this.options.infoTextSize;
    const row1 = this.options.my + this.options.infoTextSize;
    const row2 = this.options.my + 2.5 * this.options.infoTextSize;
    this.engine.updateUiMessage('mapDifficulty', { x: left, y: row1, fontSize: this.options.infoTextSize });
    this.engine.updateUiMessage('mapSeed', { x: left, y: row2, fontSize: this.options.infoTextSize });
    this.engine.updateUiMessage('gameTurn', { x: center, y: row1, fontSize: this.options.infoTextSize });
    this.engine.updateUiMessage('playerTurn', { x: center, y: row2, fontSize: this.options.infoTextSize });
    this.engine.updateUiMessage('gameScore', { x: right, y: row1, fontSize: this.options.infoTextSize });
    this.engine.updateUiMessage('hiScore', { x: right, y: row2, fontSize: this.options.infoTextSize });
  }

  repositionMapTiles() {
    const marginX = Math.floor(this.options.mx + this.options.board.px
      + 0.5 * this.options.gridSizePx);
    const marginY = Math.floor(this.options.my + this.options.board.pt
      + 0.5 * this.options.gridSizePx);

    // Note PIXI sprites are anchored at center middle.
    const iMax = Math.min(this.engine.options.gridCountX, this.engine.ui.objects.tiles.length);
    for (let i = 0; i < iMax; i++) {
      const jMax = Math.min(this.engine.options.gridCountY, this.engine.ui.objects.tiles[i].length);
      for (let j = 0; j < jMax; j++) {
        const offsetX = marginX + i * this.options.gridSizePx;
        const offsetY = marginY + j * this.options.gridSizePx;
        this.engine.ui.objects.tiles[i][j].width = this.options.gridSizePx;
        this.engine.ui.objects.tiles[i][j].height = this.options.gridSizePx;
        this.engine.ui.objects.tiles[i][j].position.set(offsetX, offsetY);
      }
    }
  }

  repositionPlayerPieces() {
    const marginX = Math.floor(
      this.options.mx + this.options.board.px + 0.5 * this.options.gridSizePx,
    );
    const marginY = Math.floor(
      this.options.my + this.options.board.pt + 0.5 * this.options.gridSizePx,
    );
    const halfGridSizePx = this.options.gridSizePx / 2;

    const playersCount = Math.min(this.store.get('playersCount'), this.engine.ui.objects.playerPieces.length);
    for (let i = 0; i < playersCount; i++) {
      const piece = this.engine.ui.objects.playerPieces[i];
      const playerData = this.store.get(`players.${i}`);

      const offsetX = marginX + playerData.x * this.options.gridSizePx;
      const offsetY = marginY + playerData.y * this.options.gridSizePx;

      const cnt = this.countPlayersAtPlayerLocation(i);
      if (cnt > 1) {
        piece.width = halfGridSizePx;
        piece.height = halfGridSizePx;
        piece.x = offsetX + (i % 2 === 0 ? -halfGridSizePx : halfGridSizePx) / 2;
        piece.y = offsetY + (i > 1 ? -halfGridSizePx : halfGridSizePx) / 2;
      } else {
        piece.width = this.options.gridSizePx;
        piece.height = this.options.gridSizePx;
        piece.x = offsetX;
        piece.y = offsetY;
      }
    }
  }

  startGame() {
    const difficultyLabel = this.store.get('gameOptions.difficultyLabels')[this.store.get('mapDifficulty')];
    this.clearGameMap();
    this.engine.updateUiMessage('mapDifficulty', { text: `Difficulty: ${difficultyLabel}` });
    this.engine.updateUiMessage('mapSeed', { text: `Map Seed: ${this.store.get('mapSeed')}` });
    this.engine.updateUiMessage('hiScore', { text: `Hi-Score: ${this.store.get('highScore')}` });
    this.createGameTiles(this.store.get('mapTiles'));
    this.createPlayerPieces(this.store.get('playersCount'));
    data.canMove = false;
  }
}
