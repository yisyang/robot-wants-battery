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
      gridCountX: 20,
      gridCountY: null,
      maxScore: 100,
      muted: false,
      controllersAllowed: [0, 1],
      difficultyLabels: ['Easy', 'Normal', 'Hard', 'Impossible'],
      waterTileChances: [0.05, 0.14, 0.19, 0.25], // Corresponds to difficulty 0/1/2/3 (easy/normal/hard/impossible)
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

    const spacing = Math.floor(this.gameOptions.gridCountX / 4);
    this.gameOptions.startLocation = { x: spacing - 1, y: spacing - 1 };
    this.gameOptions.endLocation = {
      x: this.gameOptions.gridCountX - spacing,
      y: this.gameOptions.gridCountY - spacing,
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
      muted: this.gameOptions.muted,
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
      this.uiEngine.addEventListener('turnEnded', (e) => {
        this.updateCurrentPlayerData(e.detail);
        this.nextTurn();
      });
      // Trigger it manually for initial rendering.
      this.uiEngine.refreshDisplay();
      console.log('UI engine initialized.');
    });
  }

  activatePlayerPieces() {
    for (let i = 0, playersCount = this.gameState.get('playersCount'); i < playersCount; i++) {
      this.gameState.set(`players[${i}].alive`, true);
      this.gameState.set(`players[${i}].playable`, true);
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
    this.activatePlayerPieces();
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
    // Put all players back at start location as playable.
    [...Array(this.gameState.get('playersCount')).keys()].forEach(
      (i) => {
        this.gameState.set(`players[${i}].x`, this.gameOptions.startLocation.x);
        this.gameState.set(`players[${i}].y`, this.gameOptions.startLocation.y);
        this.gameState.set(`players[${i}].score`, 0);
      },
    );
    this.gameState.savePersistedState();
    this.gameState.set('gameStatus', 1);
    this.generateBoard();
    this.uiEngine.modules.game.startGame();
    this.uiEngine.playSound('start');
    this.uiEngine.refreshDisplay();
    this.nextTurn();
  }

  nextTurn() {
    // Aggregate some numbers.
    const playersData = this.gameState.get('players');
    const totalPlayersPlayable = playersData.map((e) => (e.alive && e.playable ? 1 : 0)).reduce((a, b) => a + b);
    // Game ended.
    if (totalPlayersPlayable === 0) {
      this.gameState.set('status', 3);
      return;
    }

    // Increment turn or active player
    let currentTurn = this.gameState.get('currentTurn');
    let currentActivePlayer = this.gameState.get('currentActivePlayer') + 1;
    while (currentActivePlayer < this.gameState.get('playersCount') && !playersData[currentActivePlayer].alive) {
      currentActivePlayer += 1;
    }
    if (currentActivePlayer >= this.gameState.get('playersCount')) {
      currentTurn += 1;
      currentActivePlayer = 0;
      this.gameState.set('currentTurn', currentTurn);
      const scoreReductionMultiplier = 2 ** (3 - this.gameState.get('mapDifficulty'));
      this.gameState.set('currentScore', Math.max(0,
        this.gameOptions.maxScore - currentTurn * scoreReductionMultiplier));
    }
    this.gameState.set('currentActivePlayer', currentActivePlayer);

    [0, 1].forEach((i) => {
      this.gameState.set(`diceValue[${i}]`, Math.floor(Math.random() * 6) + 1);
    });

    this.uiEngine.modules.game.nextTurn();
  }

  updateCurrentPlayerData(data) {
    const currentActivePlayer = this.gameState.get('currentActivePlayer');
    this.gameState.set(`players[${currentActivePlayer}].alive`, data.alive);
    this.gameState.set(`players[${currentActivePlayer}].x`, data.location.x);
    this.gameState.set(`players[${currentActivePlayer}].y`, data.location.y);

    // TODO: Trigger winning message.
    if (data.location.x === this.gameOptions.endLocation.x && data.location.x === this.gameOptions.endLocation.x) {
      const playerName = this.gameState.get(`players.${currentActivePlayer}.name`);
      console.log(`${playerName} WINS!`);
      this.gameState.set(`players[${currentActivePlayer}].playable`, false);
      this.gameState.set('highScore', Math.max(this.gameState.get('currentScore'), this.gameState.get('highScore')));
      this.uiEngine.updateUiMessage('hiScore', { text: `Hi-Score: ${this.gameState.get('highScore')}` });
      this.gameState.savePersistedState();
    }
  }
}
