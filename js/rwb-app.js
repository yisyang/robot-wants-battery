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
      maxScore: 100,
      controllersAllowed: [0, 1],
      difficultyLabels: ['Easy', 'Normal', 'Hard', 'Impossible'],
      waterTileChances: [0.05, 0.15, 0.25, 0.35], // Corresponds to difficulty 0/1/2/3 (easy/normal/hard/impossible)
      playerColors: [0x0028db, 0xff002a, 0x0dfd00, 0xe9b600], // Corresponds to colors used in player sprites.
    };
    Object.assign(this.gameOptions, gameOptions);

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
      gameOptions: this.gameOptions,
      currentScore: this.gameOptions.maxScore, // -8/-4/-2/-1 per turn on easy/normal/difficult/impossible
    });

    this.uiEngine = new RwbUiEngine(this.gameState, {
      holderDivId,
      width: this.gameOptions.displayOptions.width,
      height: this.gameOptions.displayOptions.height,
      gridCountX: this.gameOptions.gridCountX,
      gridCountY: this.gameOptions.gridCountY,
    });
  }

  init() {
    return this.uiEngine.init().then(() => {
      this.uiEngine.addEventListener('newGame', (e) => {
        this.newGame(e.detail);
      });
      this.uiEngine.addEventListener('seedNewGame', () => {
        /* eslint-disable-next-line no-alert */
        const seed = window.prompt('Enter map seed to start new game with seed.', '');
        if (seed !== '') {
          this.newGame({ mapSeed: seed.substr(0, 8) });
        }
      });
      this.uiEngine.addEventListener('pause', () => {
        this.gameState.set('gameStatus', 2);
        this.uiEngine.refreshDisplay();
      });
      this.uiEngine.addEventListener('resume', () => {
        this.gameState.set('gameStatus', 1);
        this.uiEngine.refreshDisplay();
      });
      this.uiEngine.addEventListener('abandon', () => {
        this.gameState.set('gameStatus', 0);
        this.uiEngine.refreshDisplay();
      });
      this.uiEngine.addEventListener('moveRobot', (e) => {
        this.moveRobot(e.detail);
      });
      // Trigger it manually for initial rendering.
      this.uiEngine.refreshDisplay();
      console.log('UI engine initialized.');
    });
  }

  createPlayerPieces() {
    for (let i = 0, playersCount = this.gameState.get('playersCount'); i < playersCount; i++) {
      this.gameState.set(`players[${i}].alive`, true);
      this.gameState.set(`players[${i}].x`, this.gameOptions.startLocation.x);
      this.gameState.set(`players[${i}].y`, this.gameOptions.startLocation.y);
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

    // Compute water tiles.
    this.gameState.set('mapTiles', []);
    const waterTileChances = this.gameOptions.waterTileChances[this.gameState.get('mapDifficulty')];
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      this.gameState.set(`mapTiles[${i}]`, []);
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        this.gameState.set(`mapTiles[${i}][${j}]`, {
          type: randomSeeder.rand() < waterTileChances ? 'water' : 'land',
        });
      }
    }

    // Hard-code start and end locations as non-water.
    this.gameState.set(`mapTiles.${this.gameOptions.startLocation.x}.${this.gameOptions.startLocation.y}.type`,
      'start');
    this.gameState.set(`mapTiles.${this.gameOptions.endLocation.x}.${this.gameOptions.endLocation.y}.type`, 'end');

    // Place player pieces.
    this.createPlayerPieces();
  }

  newGame(options = null) {
    this.gameState.reset();
    if (options.mapSeed !== undefined) {
      this.gameState.set('mapSeed', options.mapSeed);
    }
    if (options.mapDifficulty !== undefined) {
      this.gameState.set('mapDifficulty', options.mapDifficulty);
      this.gameState.set('players[1].controller', options.playerController[1]);
      this.gameState.set('players[2].controller', options.playerController[2]);
      this.gameState.set('players[3].controller', options.playerController[3]);
      if (options.playerController[3] !== 0) {
        this.gameState.set('playersCount', 4);
      } else if (options.playerController[2] !== 0) {
        this.gameState.set('playersCount', 3);
      } else if (options.playerController[1] !== 0) {
        this.gameState.set('playersCount', 2);
      } else {
        this.gameState.set('playersCount', 1);
      }
    }
    // Put all players back at start location.
    this.gameState.set('playerLocations',
      [...Array(this.gameState.get('playersCount')).keys()].map(
        () => this.gameOptions.startLocation,
      ));
    this.gameState.savePersistedState();
    this.gameState.set('gameStatus', 1);
    this.generateBoard();
    this.uiEngine.modules.game.startGame();
    this.uiEngine.refreshDisplay();
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

    [0, 1].forEach((i) => {
      this.gameState.set(`diceValue[${i}]`, Math.floor(Math.random() * 6) + 1);
      this.gameState.set(`diceMoved[${i}]`, 0);
    });

    this.uiEngine.modules.game.nextTurn();
  }
}
