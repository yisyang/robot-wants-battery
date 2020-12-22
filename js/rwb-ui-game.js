import * as PIXI from 'pixi.js';
import { debounce } from 'lodash-es';

// Local view data.
const data = {
  activeKeyboardDice: 0,
  canMove: false,
  width: null,
  height: null,
  board: {},
  controls: {},
  isMoving: false,
  isFlying: false,
  movement: {
    start: null,
    moves: [],
    animation: {
      currentTile: [], // x, y
      nextTiles: [], // [x, y], [x, y], ...
    },
  },
};

export default class RwbUiGame {
  constructor(engine, store) {
    this.engine = engine;
    this.store = store;

    this.confirmAiMoveDebounced = debounce(this.confirmAiMove, 500);
  }

  clearGameMap() {
    // Clear map and sprites containers.
    this.engine.ui.objects.tiles.forEach((column) => {
      column.forEach((tile) => {
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

  /**
   * Clear movement data for one or both moveIndex.
   *
   * @param {?Number} moveIndex
   */
  clearMovement(moveIndex = null) {
    // Ignore if still moving.
    if (data.isMoving) {
      return;
    }
    // Remove preview overlay tiles.
    [0, 1].forEach((key) => {
      // noinspection JSIncompatibleTypesComparison
      if (moveIndex === null || moveIndex === key) {
        this.clearMovementPreviews(key);
        RwbUiGame.clearMovementData(key);
      }
    });

    // Reset local starting position data.
    const currentActivePlayer = this.store.get('currentActivePlayer');
    const { x, y } = this.store.get(`players[${currentActivePlayer}]`);
    data.movement.start = [x, y];
  }

  /**
   * Reset local movement data.
   *
   * @param {Number} moveIndex
   */
  static clearMovementData(moveIndex) {
    data.movement.moves[moveIndex] = {
      alive: false,
      diceIndex: null,
      direction: null,
      flying: false,
      tilesCrossed: [],
      target: [],
    };
  }

  /**
   * Clear colored overlay tiles of movement previews.
   *
   * @param {Number} moveIndex
   */
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

  clearProbabilityHints() {
    this.engine.ui.objects.probabilityHints.forEach((tile) => {
      this.engine.ui.containers.map.removeChild(tile);
    });
    data.displayingProbabilityHints = false;
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
    data.gridSizePx = this.computeBaseGridSize();

    // Analyze container AR vs board AR, and determine if the rest of UI should be portrait of landscape.
    const containerAR = this.engine.options.width / this.engine.options.height;
    // Additional 10% height reserved for turn/score display on board area.
    const boardAR = this.engine.options.gridCountX / this.engine.options.gridCountY / 1.1;
    data.board.width = data.gridSizePx * this.engine.options.gridCountX;
    data.board.height = data.gridSizePx * this.engine.options.gridCountY;

    data.board.pt = Math.floor(
      (1 + 0.1 * this.engine.options.gridCountY) * data.gridSizePx,
    );
    if (containerAR > boardAR) {
      data.displayMode = 'landscape';
      data.mx = Math.max(0, (this.engine.options.width - 1.4 * this.engine.options.height) / 2);
      data.my = 0;
      data.board.px = data.gridSizePx;
      data.board.widthWP = data.board.width
        + 2 * data.board.px;
      data.board.heightWP = this.engine.options.height;
      data.controls.x = data.mx + data.board.widthWP;
      data.controls.y = data.my;
      data.controls.width = this.engine.options.width
        - data.controls.x - data.mx;
      data.controls.height = data.board.heightWP;
    } else {
      data.displayMode = 'portrait';
      data.mx = 0;
      data.my = Math.max(0, (this.engine.options.height - 1.4 * this.engine.options.width) / 2);
      data.board.px = Math.floor(
        (this.engine.options.width - data.board.width) / 2,
      );
      data.board.widthWP = this.engine.options.width;
      data.board.heightWP = data.board.height
        + data.board.pt + data.gridSizePx;
      data.controls.x = data.mx;
      data.controls.y = data.my + data.board.heightWP;
      data.controls.width = data.board.widthWP;
      data.controls.height = this.engine.options.height
        - data.controls.y - data.my;
    }

    data.controls.du = 1 / 100 * Math.min(
      data.controls.width, data.controls.height,
    );

    data.infoTextSize = Math.floor(
      0.035 * this.engine.options.gridCountY * data.gridSizePx,
    );
  }

  computePlannedMovementData(moveIndex, params) {
    let diceValue = this.store.get(`diceValue[${params.dice}]`);

    // Determine starting location.
    let startingLocation;
    let flying = false;
    if (moveIndex === 0) {
      startingLocation = data.movement.start;
    } else if (params.direction === data.movement.moves[0].direction) {
      // Continued move (fly).
      startingLocation = data.movement.start;
      diceValue += this.store.get(`diceValue[${1 - params.dice}]`);
      flying = true;
    } else {
      startingLocation = data.movement.moves[0].target;
    }

    // Convert movement into x/y increment.
    const axis = (params.direction === 'Left' || params.direction === 'Right') ? 0 : 1;
    const increment = (params.direction === 'Down' || params.direction === 'Right') ? 1 : -1;

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
        // We will store the last move anyways for animation purposes.
        // Even though [i, j] does not exist in tile memory.
        tilesCrossed.push([i, j]);
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
      diceIndex: oob ? -1 : params.dice, // Hack: storing invalid diceIndex allows illegal moves to be overwritten.
      direction: params.direction,
      flying,
      tilesCrossed, // Note: with oob some tile indices may not actually exist.
      target: oob ? [] : tilesCrossed[tilesCrossed.length - 1],
    };
  }

  confirmAiMove() {
    const aiMove = this.store.get('aiMove');

    let dice1 = 0;
    let dice2 = 1;
    if (this.store.get('diceValue[0]') !== aiMove.values[0]) {
      dice1 = 1;
      dice2 = 0;
    }
    // First move.
    this.planMove({
      dice: dice1,
      direction: aiMove.dirs[0]
    });

    // Second move.
    window.setTimeout(() => {
      this.planMove({
        dice: dice2,
        direction: aiMove.dirs[1]
      });

      // Confirm move.
      window.setTimeout(() => {
        this.confirmMove();
      }, 1000);
    }, 1000);
  }

  confirmMove() {
    if (!this.controlsEnabled()) {
      return;
    }
    // Must have both movements issued before moving.
    if (data.movement.moves[1].direction === null) {
      return;
    }

    // Remove keyboard highlighting.
    data.activeKeyboardDice = null;
    this.highlightActiveKeyboardDice();

    // Start movement.
    this.moveRobotStep();
  }

  controlsEnabled() {
    return this.store.get('gameStatus') === 1 && !this.store.get('gamePaused') && !data.isMoving;
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
    const [i0, j0] = moveData.tilesCrossed[0];
    moveData.tilesCrossed.forEach(([i, j]) => {
      const tileColor = (i === i0 && j === j0) ? 0xffff00 : color;
      const tile = RwbUiGame.drawTintedTile(i, j, tileColor);
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

  drawProbabilities() {
    const probDistribution = this.store.get('probDistribution');
    probDistribution.forEach((column, x) => {
      column.forEach((prob, y) => {
        // R: 255 @ prob 0, 64 @ prob 0.8, 64 @ prob 1
        // G: 64 @ prob 0, 64 @ prob 0.2, 255 @ prob 1
        // B: 64 @ prob 0, 64 @ prob 0.2, 0 @ prob 0.5, 64 @ prob 0.8, 64 @ prob 1
        const r = Math.floor(Math.min(255, Math.max(64, -240 * prob + 255)));
        const g = Math.floor(Math.min(255, Math.max(64, 240 * prob + 15)));
        const b = Math.floor(Math.min(64, Math.max(0, -210 * (0.3 - Math.abs(prob - 0.5)) + 64)));

        const fill = r * 65536 + g * 256 + b;
        const tile = RwbUiGame.drawTintedTile(x, y, fill);
        tile.alpha = 1;
        this.engine.ui.objects.probabilityHints.push(tile);
        this.engine.ui.containers.map.addChild(tile);
      });
    });
    data.displayingProbabilityHints = true;
  }

  static drawTintedTile(x, y, fill) {
    const tile = new PIXI.Graphics();
    const marginX = data.mx + data.board.px;
    const marginY = data.my + data.board.pt;
    const offsetX = marginX + x * data.gridSizePx;
    const offsetY = marginY + y * data.gridSizePx;
    tile.beginFill(fill);
    tile.drawRect(0, 0, data.gridSizePx, data.gridSizePx);
    tile.endFill();
    tile.alpha = 0.5;
    tile.position.set(offsetX, offsetY);
    return tile;
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
      RwbUiGame.clearMovementData(key);
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
      this.confirmMove();
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
        btn.on('mouseout', () => { this.engine.clearTooltips(); });
        this.engine.ui.objects[key][`btn${btnText}`] = btn;
        this.engine.ui.containers[key].addChild(btn);
      });
    });
    this.engine.ui.objects.controls.btnConfirm.on('mouseover', () => {
      this.engine.attachTooltip('controls.btnConfirm', {
        text: 'Click to confirm movement.\n\n'
          + '(Shortcuts: Z or Numpad Enter)',
      });
    });
    this.engine.ui.objects.controls.btnCancel.on('mouseover', () => {
      this.engine.attachTooltip('controls.btnCancel', {
        text: 'Click to remove movement preview.\n\n'
          + '(Shortcuts: C or Numpad 0)',
      });
    });

    // Dice faces.
    // Two dice, init at 0.
    [0, 1].forEach((i) => {
      const diceFace = new PIXI.Sprite(this.engine.textures['dice-face-0']);
      diceFace.interactive = true;
      diceFace.on('mouseover', () => {
        this.engine.attachTooltip(`diceFaces[${i}]`, {
          text: 'Click arrows around any dice to preview moves.\n\n'
            + '(Shortcuts: Arrow keys OR Numpad OR W/A/S/D)\n'
            + '(X OR Numpad 5 can be used to toggle dice)',
        });
      });
      diceFace.on('mouseout', () => { this.engine.clearTooltips(); });
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
      if (!this.controlsEnabled()) {
        return;
      }
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
        // Get active dice based on default and last moved dice.
        data.activeKeyboardDice = (data.activeKeyboardDice === 1 ? 1 : 0);
        // Second-guess player intention.
        if (data.movement.moves[0].diceIndex === data.activeKeyboardDice
          && data.movement.moves[0].direction === direction
        ) {
          // If current dice has moved in first movement and we're attempting the same direction.
          // Then the player probably intends to use the other dice to fly.
          data.activeKeyboardDice = 1 - data.activeKeyboardDice;
        } else if (data.movement.moves[1].diceIndex === data.activeKeyboardDice
          && data.movement.moves[1].direction === direction
        ) {
          // Player has used current dice and direction for second movement.
          // A repeat probably means that the player wants to do this for first movement instead.
          this.clearMovement();
        }

        // Save current active dice and emit directional event.
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
    const msgDifficulty = this.engine.createUiMessage('mapDifficulty');
    msgDifficulty.interactive = true;
    msgDifficulty.on('click', () => {
      this.engine.dispatchEvent(new CustomEvent('toggleProb', {}));
    });

    const msgSeed = this.engine.createUiMessage('mapSeed');
    msgSeed.interactive = true;
    msgSeed.on('click', () => {
      this.engine.dispatchEvent(new CustomEvent('seedNewGame', {}));
    });

    this.engine.createUiMessage('gameTurn', { align: 'center' });
    this.engine.createUiMessage('playerTurn', { align: 'center' });
    this.engine.createUiMessage('gameScore', { align: 'right' });
    this.engine.createUiMessage('hiScore', { align: 'right' });
    this.engine.createUiMessage('gameOver', {
      align: 'center',
      fill: 0x0000ff,
      fontSize: 2 * data.gridSizePx,
    });
  }

  /**
   * Show step by step movement of confirmed movement path.
   */
  moveRobotStep() {
    // If we have just started moving, initialize animation data.
    if (!data.isMoving) {
      data.isMoving = true;
      data.isFlying = data.movement.moves[1].flying;
      if (data.isFlying) {
        // Hack: in flying movements the complete path is stored in move 1.
        data.movement.animation.nextTiles = data.movement.moves[1].tilesCrossed;
        this.engine.playSound('frightened', true);
      } else {
        data.movement.animation.nextTiles = data.movement.moves[0].tilesCrossed.concat(
          data.movement.moves[1].tilesCrossed.slice(1),
        );
        this.engine.playSound('ka', true);
      }
    }

    const currentActivePlayer = this.store.get('currentActivePlayer');

    // Put player at "next tile".
    [data.movement.animation.currentTile] = data.movement.animation.nextTiles.splice(0, 1);
    this.repositionPlayerPiece(currentActivePlayer, false, data.movement.animation.currentTile);

    // Animation done when there are no more tiles to move to.
    if (data.movement.animation.nextTiles.length === 0) {
      // After animations, update player position to target position.
      const [x, y] = data.movement.moves[1].target;
      this.engine.stopSound(data.isFlying ? 'frightened' : 'ka');
      data.isMoving = false;
      data.isFlying = false;
      if (!data.movement.moves[1].alive) {
        this.engine.playSound('die');
      }
      this.engine.dispatchEvent(new CustomEvent('turnEnded', {
        detail: {
          location: { x, y },
          alive: data.movement.moves[1].alive,
        },
      }));
      return;
    }

    // Otherwise we move towards the next position
    const playerPiece = this.engine.ui.objects.playerPieces[currentActivePlayer];
    const newX = playerPiece.x + data.gridSizePx
      * (data.movement.animation.nextTiles[0][0] - data.movement.animation.currentTile[0]);
    const newY = playerPiece.y + data.gridSizePx
      * (data.movement.animation.nextTiles[0][1] - data.movement.animation.currentTile[1]);

    // Move player towards the further next tile.
    this.engine.addTransition(`playerPieces[${currentActivePlayer}]`, {
      steps: 12,
      translate: { x: newX, y: newY },
      cb: () => {
        this.moveRobotStep();
      },
    });
  }

  nextTurn() {
    const currentActivePlayer = this.store.get('currentActivePlayer');
    const currentTurn = this.store.get('currentTurn');

    this.engine.updateUiMessage('gameTurn', { text: `Turn: ${currentTurn}` });
    this.engine.updateUiMessage('gameScore', { text: `Score: ${this.store.get('currentScore')}` });

    const playerName = this.store.get(`players[${currentActivePlayer}].name`);
    this.engine.updateUiMessage('playerTurn', {
      text: `${playerName}'s turn.`,
      fill: this.store.get('gameOptions.playerColors')[currentActivePlayer],
      fontSize: 1.2 * data.gridSizePx,
      x: data.mx + data.board.widthWP / 2,
      y: data.my + data.board.heightWP / 2,
    });
    this.engine.addTransition('messages.playerTurn', {
      translate: { y: data.my + 4 * data.infoTextSize },
      cb: () => {
        this.engine.updateUiMessage('playerTurn', {
          x: data.mx + data.board.widthWP / 2,
          y: data.my + 2.5 * data.infoTextSize,
          fontSize: data.infoTextSize,
        });
      },
    });

    this.repositionPlayerPieces();
    this.clearMovement();
    this.clearProbabilityHints();
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

          switch (this.store.get(`players[${currentActivePlayer}].controller`)) {
            case 2:
            case 3:
              // Easy & Hard AI
              this.confirmAiMoveDebounced();
              break;
            default:
              // Human
              this.enableDiceButtons(i);
          }
        },
      });
    });
  }

  planMove(params) {
    if (!this.controlsEnabled()) {
      return;
    }
    if (this.store.get(`diceValue[${params.dice}]`) === 0) {
      return;
    }

    // In general, we'll be modifying the first move.
    let moveIndex = 0;
    // To move onto second move, the first move must have been made by another dice.
    if (data.movement.moves[0].diceIndex === (1 - params.dice)) {
      // And player needs to be alive OR flying after the first move.
      if (data.movement.moves[0].alive || data.movement.moves[0].direction === params.direction) {
        // And player must not have already tried the same direction and ended with death.
        if (data.movement.moves[1].direction !== params.direction) {
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

    this.clearProbabilityHints();
    this.computePlannedMovementData(moveIndex, params);
    this.drawMovementPreviews();

    // In addition, guess player intention on next active keyboard dice.
    if (data.activeKeyboardDice !== null) {
      // First move and valid move. Next action will likely be other dice.
      if (moveIndex === 0 && data.movement.moves[0].alive) {
        data.activeKeyboardDice = 1 - data.activeKeyboardDice;
      }
      // Player is flying. Likely no more next move.
      if (moveIndex === 1 && !data.movement.moves[0].alive) {
        data.activeKeyboardDice = null;
      }
      this.highlightActiveKeyboardDice();
    }
  }

  refreshDisplay() {
    this.computeGameLayout();

    // Resize game board.
    this.engine.ui.objects.map.board.x = data.mx;
    this.engine.ui.objects.map.board.y = data.my;
    this.engine.ui.objects.map.board.width = data.board.widthWP;
    this.engine.ui.objects.map.board.height = data.board.heightWP;

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

      // Re-draw movement previews.
      this.drawMovementPreviews();

      // Disable hints if visible.
      this.clearProbabilityHints();
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
      data.controls.x,
      data.controls.y,
    );
    this.engine.ui.objects.map.controlsArea.width = data.controls.width;
    this.engine.ui.objects.map.controlsArea.height = data.controls.height;

    // Pause button.
    this.engine.ui.objects.controls.btnPause.width = 15 * data.controls.du;
    this.engine.ui.objects.controls.btnPause.height = 15 * data.controls.du;
    this.engine.ui.objects.controls.btnPause.position.set(
      data.controls.x + data.controls.width - 10 * data.controls.du,
      data.controls.y + 10 * data.controls.du,
    );

    const btnTexts = ['Cancel', 'Confirm'];
    [0, 1].forEach((i) => {
      const btn = this.engine.ui.objects.controls[`btn${btnTexts[i]}`];
      btn.width = 25 * data.controls.du;
      btn.height = 25 * data.controls.du;
      if (data.displayMode === 'landscape') {
        // Landscape.
        btn.position.set(
          data.mx
          + data.board.widthWP
          + (30 + i * 40) * data.controls.du,
          0.85 * data.controls.height,
        );
      } else {
        // Portrait.
        btn.position.set(
          0.85 * data.controls.width,
          data.my
          + data.board.heightWP
          + (30 + i * 40) * data.controls.du,
        );
      }
    });

    // Dice faces.
    const baselineX = data.mx
      + data.board.widthWP + 50 * data.controls.du;
    const baselineY = data.my
      + data.board.heightWP + 50 * data.controls.du;
    const diceFacePos = [
      [baselineX, baselineY],
      [baselineX, baselineY],
    ];
    if (data.displayMode === 'landscape') {
      // Landscape.
      diceFacePos[0][1] = 0.2 * data.controls.height;
      diceFacePos[1][1] = 0.55 * data.controls.height;
    } else {
      // Portrait.
      diceFacePos[0][0] = 0.2 * data.controls.width;
      diceFacePos[1][0] = 0.55 * data.controls.width;
    }
    // Two dice, init at 0.
    [0, 1].forEach((i) => {
      this.engine.ui.objects.diceFaces[i].width = 25 * data.controls.du;
      this.engine.ui.objects.diceFaces[i].height = 25 * data.controls.du;
      this.engine.ui.objects.diceFaces[i].position.set(diceFacePos[i][0], diceFacePos[i][1]);

      // Dice controls.
      [
        ['Up', 0, -1],
        ['Down', 0, 1],
        ['Left', -1, 0],
        ['Right', 1, 0],
      ].forEach(([dir, x, y]) => {
        const btn = this.engine.ui.objects[`btnDice${i}${dir}`];
        btn.width = 12 * data.controls.du;
        btn.height = 12 * data.controls.du;
        btn.position.set(
          diceFacePos[i][0] + 25 * x * data.controls.du,
          diceFacePos[i][1] + 25 * y * data.controls.du,
        );
      });
    });
  }

  repositionGameMessages() {
    // Update game status messages at top.
    const left = data.mx + data.infoTextSize;
    const center = data.mx + data.board.widthWP / 2;
    const right = data.mx + data.board.widthWP - data.infoTextSize;
    const row1 = data.my + data.infoTextSize;
    const row2 = data.my + 2.5 * data.infoTextSize;
    const middle = data.my + data.board.heightWP / 2;
    this.engine.updateUiMessage('mapDifficulty', { x: left, y: row1, fontSize: data.infoTextSize });
    this.engine.updateUiMessage('mapSeed', { x: left, y: row2, fontSize: data.infoTextSize });
    this.engine.updateUiMessage('gameTurn', { x: center, y: row1, fontSize: data.infoTextSize });
    this.engine.updateUiMessage('playerTurn', { x: center, y: row2, fontSize: data.infoTextSize });
    this.engine.updateUiMessage('gameScore', { x: right, y: row1, fontSize: data.infoTextSize });
    this.engine.updateUiMessage('hiScore', { x: right, y: row2, fontSize: data.infoTextSize });
    this.engine.updateUiMessage('gameOver', { x: center, y: middle, fontSize: 2 * data.gridSizePx });
  }

  repositionMapTiles() {
    const marginX = data.mx + data.board.px + 0.5 * data.gridSizePx;
    const marginY = data.my + data.board.pt + 0.5 * data.gridSizePx;

    // Note PIXI sprites are anchored at center middle.
    const iMax = Math.min(this.engine.options.gridCountX, this.engine.ui.objects.tiles.length);
    for (let i = 0; i < iMax; i++) {
      const jMax = Math.min(this.engine.options.gridCountY, this.engine.ui.objects.tiles[i].length);
      for (let j = 0; j < jMax; j++) {
        const offsetX = marginX + i * data.gridSizePx;
        const offsetY = marginY + j * data.gridSizePx;
        this.engine.ui.objects.tiles[i][j].width = data.gridSizePx;
        this.engine.ui.objects.tiles[i][j].height = data.gridSizePx;
        this.engine.ui.objects.tiles[i][j].position.set(offsetX, offsetY);
      }
    }
  }

  repositionPlayerPiece(playerIndex, halfSize = false, tileOverwrite = null) {
    const marginX = data.mx + data.board.px + 0.5 * data.gridSizePx;
    const marginY = data.my + data.board.pt + 0.5 * data.gridSizePx;
    const halfGridSizePx = data.gridSizePx / 2;

    const piece = this.engine.ui.objects.playerPieces[playerIndex];
    let xy = {};
    if (tileOverwrite !== null) {
      [xy.x, xy.y] = tileOverwrite;
    } else {
      xy = (this.store.get(`players[${playerIndex}]`));
    }
    const offsetX = marginX + xy.x * data.gridSizePx;
    const offsetY = marginY + xy.y * data.gridSizePx;

    if (halfSize) {
      piece.width = halfGridSizePx;
      piece.height = halfGridSizePx;
      piece.x = offsetX + (playerIndex % 2 === 0 ? -halfGridSizePx : halfGridSizePx) / 2;
      piece.y = offsetY + (playerIndex > 1 ? -halfGridSizePx : halfGridSizePx) / 2;
    } else {
      piece.width = data.gridSizePx;
      piece.height = data.gridSizePx;
      piece.x = offsetX;
      piece.y = offsetY;
    }
  }

  repositionPlayerPieces() {
    const playersCount = Math.min(this.store.get('playersCount'), this.engine.ui.objects.playerPieces.length);
    for (let i = 0; i < playersCount; i++) {
      const cnt = this.countPlayersAtPlayerLocation(i);
      this.repositionPlayerPiece(i, cnt > 1);
    }
  }

  showGameOverMessage(params) {
    const center = data.mx + data.board.widthWP / 2;
    const middle = data.my + data.board.heightWP / 2;
    this.engine.updateUiMessage('gameOver', {
      ...params,
      alpha: 0.9,
      x: center,
      y: middle,
    });

    // Also make sure all player pieces are positioned correctly after previous  movement.
    this.clearMovement();
    this.repositionPlayerPieces();
  }

  startGame() {
    const difficultyLabel = this.store.get('gameOptions.difficultyLabels')[this.store.get('mapDifficulty')];
    this.clearGameMap();
    this.engine.updateUiMessage('mapDifficulty', { text: `Difficulty: ${difficultyLabel}` });
    this.engine.updateUiMessage('mapSeed', { text: `Map Seed: ${this.store.get('mapSeed')}` });
    this.engine.updateUiMessage('hiScore', { text: `Hi-Score: ${this.store.get('highScore')}` });
    this.engine.updateUiMessage('gameOver', { text: '' });
    this.createGameTiles(this.store.get('mapTiles'));
    this.createPlayerPieces(this.store.get('playersCount'));
    data.canMove = false;
  }

  toggleProbDisplay() {
    if (data.displayingProbabilityHints) {
      this.clearProbabilityHints();
    } else {
      this.clearProbabilityHints();
      this.drawProbabilities();
    }
  }
}
