import RandomSeeder from './random-seeder.js';
import RwbUiEngine from './rwb-ui-engine.js';
import RwbState from './rwb-state.js';

export default class RwbApp {
  constructor(holderDivId, gameOptions = {}) {
    // Options should not be changed once init is complete.
    this.gameOptions = {
      displayOptions: {
        width: null,
        height: null,
      },
      gridCountX: 16,
      gridCountY: null,
      playerLocations: [],
      maxScore: 100,
      difficultyLabels: ['Easy', 'Normal', 'Hard', 'Impossible'],
      waterTileChances: [0.05, 0.15, 0.25, 0.35], // Corresponds to difficulty 0/1/2/3 (easy/normal/hard/impossible)
      playerColors: [0x0028db, 0xff002a, 0x0dfd00, 0xe9b600], // Corresponds to colors used in player sprites.
    };
    this.gameOptions = Object.assign(this.gameOptions, gameOptions);

    // Populate computed options.
    if (this.gameOptions.gridCountY === null) {
      // noinspection JSSuspiciousNameCombination
      this.gameOptions.gridCountY = this.gameOptions.gridCountX;
    }
    if (this.gameOptions.gridCountX < 10 || this.gameOptions.gridCountY < 10) {
      throw Error('Error: Grid count too few to be playable! Please increase canvas width/height.');
    }
    this.gameOptions.startLocation = { x: 3, y: 3 };
    this.gameOptions.endLocation = {
      x: this.gameOptions.gridCountX - 4,
      y: this.gameOptions.gridCountY - 4,
    };

    // Game state contains ALL state info for the game in progress,
    // and can be used to re-render the game board.
    this.gameState = new RwbState({
      currentScore: this.gameOptions.maxScore, // -8/-4/-2/-1 per turn on easy/normal/difficult/impossible
    });

    this.uiEngine = new RwbUiEngine(this.gameState, {
      holderDivId,
      width: this.gameOptions.displayOptions.width,
      height: this.gameOptions.displayOptions.height,
      gridCountX: this.gameOptions.gridCountX,
      gridCountY: this.gameOptions.gridCountY,
    });

    this.init();
  }

  init() {
    this.uiEngine.init().then(() => {
      // Trigger it manually for initial rendering.
      this.newGame();
    }).catch((e) => {
      console.log('Failed to initialize UI.');
      console.error(e);
    });
  }

  createPlayerPieces() {
    for (let i = 0, playersCount = this.gameState.get('playersCount'); i < playersCount; i++) {
      this.gameState.set(`players.${i}.alive`, true);
      this.gameState.set(`players.${i}.x`, this.gameOptions.startLocation.x);
      this.gameState.set(`players.${i}.y`, this.gameOptions.startLocation.y);
    }
  }

  generateBoard() {
    // Seed RNG.
    let seedPhrase = this.gameState.get('mapSeed');
    if (seedPhrase === null || seedPhrase === '') {
      seedPhrase = Math.floor(Math.random() * 1e6).toString();
      this.gameState.set('mapSeed', seedPhrase);
    }
    const randomSeeder = new RandomSeeder(seedPhrase);

    this.uiEngine.updateUiMessage('mapInfo', { text: `Map Seed: ${seedPhrase}` });
    this.uiEngine.updateUiMessage('hiScore', { text: `Hi-Score: ${this.gameState.get('highScore')}` });

    // Compute water tiles.
    this.gameState.set('mapTiles', []);
    const waterTileChances = this.gameOptions.waterTileChances[this.gameState.get('mapDifficulty')];
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      this.gameState.set(`mapTiles.${i}`, []);
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        this.gameState.set(`mapTiles.${i}.${j}`, {
          type: randomSeeder.rand() < waterTileChances ? 'water' : 'land',
        });
      }
    }

    // Hard-code start and end locations as non-water.
    this.gameState.set(`mapTiles.${this.gameOptions.startLocation.x}.${this.gameOptions.startLocation.y}.type`,
      'start');
    this.gameState.set(`mapTiles.${this.gameOptions.endLocation.x}.${this.gameOptions.endLocation.y}.type`, 'end');

    // Create map tiles.
    this.uiEngine.createGameTiles(this.gameState.get('mapTiles'));

    // Place player pieces.
    this.createPlayerPieces();
    this.uiEngine.createPlayerPieces(this.gameState.get('playersCount'));
  }

  newGame() {
    this.gameState.savePersistedState();
    this.generateBoard();
    this.uiEngine.handleWindowResize();
    this.nextTurn();
  }

  nextTurn() {
    // Increment turn or active player
    let currentTurn = this.gameState.get('currentTurn');
    let currentActivePlayer = this.gameState.get('currentActivePlayer') + 1;
    if (currentActivePlayer >= this.gameState.get('playersCount')) {
      currentTurn += 1;
      currentActivePlayer = 0;
      this.gameState.set('currentTurn', currentTurn);
      const scoreReductionMultiplier = 2 ** (3 - this.gameState.get('mapDifficulty'));
      this.gameState.set('currentScore', Math.max(0,
        this.gameOptions.get('maxScore') - currentTurn * scoreReductionMultiplier));
    }
    this.gameState.set('currentActivePlayer', currentActivePlayer);

    const difficultyLabel = this.gameOptions.difficultyLabels[this.gameState.get('mapDifficulty')];

    this.uiEngine.updateUiMessage('gameTurn', { text: `(${difficultyLabel}) Turn: ${currentTurn}` });
    this.uiEngine.updateUiMessage('gameScore', { text: `Score: ${this.gameState.get('currentScore')}` });

    // const playerName = this.gameState.get(`players.${currentActivePlayer}.name`);
    // this.uiEngine.updateUiMessage('playerTurn', {
    //   text: `${playerName}'s turn.`,
    //   fill: this.gameOptions.playerColors[currentActivePlayer],
    //   fontSize: 1.2 * this.uiEngine.displayOptions.gridSizePx,
    // });

    // TODO: Remove once game is playable.
    this.uiEngine.updateUiMessage('playerTurn', {
      text: '\nUNDER CONSTRUCTION\nNot yet playable',
      align: 'center',
      fill: 0xff0000,
      fontSize: 1.2 * this.uiEngine.displayOptions.gridSizePx,
      x: this.uiEngine.displayOptions.boardWidthWithMargin / 2,
      y: this.uiEngine.displayOptions.boardHeightWithMargin / 2,
    });
  }

  reset() {
    this.uiEngine.clearStage();
    this.uiEngine.clearUiMessages();
  }
}
