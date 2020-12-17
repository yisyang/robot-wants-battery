import * as PIXI from 'pixi.js';

export default class RwbUiGame {
  constructor(engine, gameState) {
    this.engine = engine;
    this.gameState = gameState;

    this.options = {
      width: null,
      height: null,
      board: {},
      controls: {},
    };
  }

  clearGameMap() {
    // Clear map and sprites containers.
    this.engine.ui.objects.tiles.map((row) => {
      row.map((tile) => {
        this.engine.ui.containers.map.removeChild(tile);
      });
    });
    this.engine.ui.objects.tiles = [];
    this.engine.ui.objects.playerPieces.map((pp) => {
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

  computeBaseGridSize() {
    const gridSizePxX = this.engine.options.width / (this.engine.options.gridCountX + 2);
    // Additional 10% height reserved for turn/score display.
    const gridSizePxY = this.engine.options.height / (this.engine.options.gridCountY + 2) / 1.1;
    const gridSizePxBeforeReserveMin = Math.floor(Math.min(gridSizePxX, gridSizePxY));
    // Reserve 33% width or height for other UI controls.
    const gridSizePxAfterReserveMax = Math.floor(Math.max(gridSizePxX, gridSizePxY) / 1.33);
    const gridSizePx = Math.min(gridSizePxBeforeReserveMin, gridSizePxAfterReserveMax);
    if (gridSizePx < 20) {
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

  /**
   * Initialize game UI.
   */
  init() {
    this.initGameControls();
    this.initUiMessages();
  }

  initGameControls() {
    // Draw base board.
    this.engine.createContainerRectangle('board', { fill: 0x3090ff, container: 'map' });
    this.engine.createContainerRectangle('controlsArea', { fill: 0x303030, container: 'map' });

    // Init pause menu related buttons.
    for (const btnText of ['Resume', 'Abandon', 'Pause']) {
      const btn = new PIXI.Sprite(this.engine.textures[`btn-${btnText.toLowerCase()}`]);
      btn.interactive = true;
      btn.on('click', () => {
        this.engine.dispatchEvent(new CustomEvent(btnText.toLowerCase(), {}));
      });
      this.engine.ui.objects.menu[`btn${btnText}`] = btn;
    }
    this.engine.ui.containers.menuPause.addChild(this.engine.ui.objects.menu.btnResume);
    this.engine.ui.containers.menuPause.addChild(this.engine.ui.objects.menu.btnAbandon);
    // Pause button itself is displayed on main game screen.
    this.engine.ui.containers.controls.addChild(this.engine.ui.objects.menu.btnPause);

    // Dice faces.
    // Two dice, init at 0.
    for (let i = 0; i < 2; i++) {
      const diceFace = new PIXI.Sprite(this.engine.textures['dice-face-0']);
      this.engine.ui.objects.diceFaces.push(diceFace);
      this.engine.ui.containers.controls.addChild(diceFace);

      // Dice controls.
      // Two sets, one for each dice.
      for (const direction of ['Up', 'Down', 'Left', 'Right']) {
        const btn = new PIXI.Sprite(this.engine.textures[`btn-${direction.toLowerCase()}`]);
        btn.interactive = true;
        this.engine.ui.objects[`btnDice${i}${direction}`] = btn;
        this.engine.ui.containers.controls.addChild(btn);
      }
    }
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

  nextTurn() {
    const currentActivePlayer = this.gameState.get('currentActivePlayer');
    const currentTurn = this.gameState.get('currentTurn');

    this.engine.updateUiMessage('gameTurn', { text: `Turn: ${currentTurn}` });
    this.engine.updateUiMessage('gameScore', { text: `Score: ${this.gameState.get('currentScore')}` });

    const playerName = this.gameState.get(`players.${currentActivePlayer}.name`);
    this.engine.updateUiMessage('playerTurn', {
      text: `${playerName}'s turn.`,
      fill: this.gameState.get('gameOptions.playerColors')[currentActivePlayer],
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
  }

  refreshDisplay() {
    this.computeGameLayout();

    // Resize game board.
    this.engine.ui.objects.map.board.x = this.options.mx;
    this.engine.ui.objects.map.board.y = this.options.my;
    this.engine.ui.objects.map.board.width = this.options.board.widthWP;
    this.engine.ui.objects.map.board.height = this.options.board.heightWP;

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

  repositionGameControls() {
    // Update pause menu.
    for (const btnText of ['Resume', 'Abandon']) {
      this.engine.ui.objects.menu[`btn${btnText}`].width = 32 * this.engine.options.du;
      this.engine.ui.objects.menu[`btn${btnText}`].height = 10 * this.engine.options.du;
    }
    this.engine.ui.objects.menu.btnResume.position.set(this.engine.options.width / 2, 40 * this.engine.options.du);
    this.engine.ui.objects.menu.btnAbandon.position.set(this.engine.options.width / 2, 60 * this.engine.options.du);

    // Update controls area.
    this.engine.ui.objects.map.controlsArea.position.set(
      this.options.controls.x,
      this.options.controls.y,
    );
    this.engine.ui.objects.map.controlsArea.width = this.options.controls.width;
    this.engine.ui.objects.map.controlsArea.height = this.options.controls.height;

    // Pause button.
    this.engine.ui.objects.menu.btnPause.width = 15 * this.options.controls.du;
    this.engine.ui.objects.menu.btnPause.height = 15 * this.options.controls.du;
    this.engine.ui.objects.menu.btnPause.position.set(
      this.options.controls.x + this.options.controls.width - 10 * this.options.controls.du,
      this.options.controls.y + 10 * this.options.controls.du,
    );

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
      diceFacePos[0][1] = 0.27 * this.options.controls.height;
      diceFacePos[1][1] = 0.73 * this.options.controls.height;
    } else {
      // Portrait.
      diceFacePos[0][0] = 0.27 * this.options.controls.width;
      diceFacePos[1][0] = 0.73 * this.options.controls.width;
    }
    // Two dice, init at 0.
    for (let i = 0; i < 2; i++) {
      this.engine.ui.objects.diceFaces[i].width = 25 * this.options.controls.du;
      this.engine.ui.objects.diceFaces[i].height = 25 * this.options.controls.du;
      this.engine.ui.objects.diceFaces[i].position.set(diceFacePos[i][0], diceFacePos[i][1]);

      // Dice controls.
      for (const val of Object.values([
        ['Up', 0, -1],
        ['Down', 0, 1],
        ['Left', -1, 0],
        ['Right', 1, 0],
      ])) {
        const btn = this.engine.ui.objects[`btnDice${i}${val[0]}`];
        btn.width = 12 * this.options.controls.du;
        btn.height = 12 * this.options.controls.du;
        btn.position.set(
          diceFacePos[i][0] + 25 * val[1] * this.options.controls.du,
          diceFacePos[i][1] + 25 * val[2] * this.options.controls.du,
        );
      }
    }
  }

  repositionGameMessages() {
    // Update game status messages at top.
    const left = this.options.mx + 2.5 * this.options.infoTextSize;
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

    const playersCount = Math.min(this.gameState.get('playersCount'), this.engine.ui.objects.playerPieces.length);
    for (let i = 0; i < playersCount; i++) {
      const piece = this.engine.ui.objects.playerPieces[i];
      const playerData = this.gameState.get(`players.${i}`);

      const offsetX = marginX + playerData.x * this.options.gridSizePx;
      const offsetY = marginY + playerData.y * this.options.gridSizePx;

      const cnt = this.gameState.countPlayersAtPlayerLocation(i);
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
    const difficultyLabel = this.gameState.get('gameOptions.difficultyLabels')[this.gameState.get('mapDifficulty')];
    this.clearGameMap();
    this.engine.updateUiMessage('mapDifficulty', { text: `Difficulty: ${difficultyLabel}` });
    this.engine.updateUiMessage('mapSeed', { text: `Map Seed: ${this.gameState.get('mapSeed')}` });
    this.engine.updateUiMessage('hiScore', { text: `Hi-Score: ${this.gameState.get('highScore')}` });
    this.createGameTiles(this.gameState.get('mapTiles'));
    this.createPlayerPieces(this.gameState.get('playersCount'));
  }
}
