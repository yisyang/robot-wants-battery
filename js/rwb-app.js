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
      waterTileChances: [0.05, 0.15, 0.22, 0.35], // Corresponds to difficulty 0/1/2/3 (easy/normal/hard/impossible)
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
    this.store = new RwbState({
      gameOptions: this.gameOptions,
      currentScore: this.gameOptions.maxScore, // -8/-4/-2/-1 per turn on easy/normal/difficult/impossible
    });

    this.uiEngine = new RwbUiEngine(this.store, {
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
        this.store.set('gamePaused', true);
        this.uiEngine.refreshDisplay();
      });
      this.uiEngine.addEventListener('resume', () => {
        this.store.set('gamePaused', false);
        this.uiEngine.refreshDisplay();
      });
      this.uiEngine.addEventListener('abandon', () => {
        this.store.set('gameStatus', 0);
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
    for (let i = 0, playersCount = this.store.get('playersCount'); i < playersCount; i++) {
      this.store.set(`players[${i}].alive`, true);
      this.store.set(`players[${i}].playable`, true);
    }
  }

  generateBoard() {
    // Seed RNG.
    let seedPhrase = this.store.get('mapSeed');
    if (seedPhrase === null || seedPhrase === '') {
      seedPhrase = Math.floor(Math.random() * 1e6).toString();
      this.store.set('mapSeed', seedPhrase);
    }
    const randomSeeder = new RandomSeeder(seedPhrase);

    // Compute water tiles.
    this.store.set('mapTiles', []);
    const waterTileChances = this.gameOptions.waterTileChances[this.store.get('mapDifficulty')];
    for (let i = 0; i < this.gameOptions.gridCountX; i++) {
      this.store.set(`mapTiles[${i}]`, []);
      for (let j = 0; j < this.gameOptions.gridCountY; j++) {
        this.store.set(`mapTiles[${i}][${j}]`, {
          type: randomSeeder.rand() < waterTileChances ? 'water' : 'land',
        });
      }
    }

    // Hard-code start and end locations as non-water.
    this.store.set(`mapTiles.${this.gameOptions.startLocation.x}.${this.gameOptions.startLocation.y}.type`,
      'start');
    this.store.set(`mapTiles.${this.gameOptions.endLocation.x}.${this.gameOptions.endLocation.y}.type`, 'end');

    // Place player pieces.
    this.activatePlayerPieces();
  }

  newGame(options = null) {
    this.store.reset();
    if (options.mapSeed !== undefined) {
      this.store.set('mapSeed', options.mapSeed);
    }
    if (options.mapDifficulty !== undefined) {
      this.store.set('mapDifficulty', options.mapDifficulty);
      this.store.set('players[1].controller', options.playerController[1]);
      this.store.set('players[2].controller', options.playerController[2]);
      this.store.set('players[3].controller', options.playerController[3]);
      if (options.playerController[3] !== 0) {
        this.store.set('playersCount', 4);
      } else if (options.playerController[2] !== 0) {
        this.store.set('playersCount', 3);
      } else if (options.playerController[1] !== 0) {
        this.store.set('playersCount', 2);
      } else {
        this.store.set('playersCount', 1);
      }
    }
    // Put all players back at start location as playable.
    [...Array(this.store.get('playersCount')).keys()].forEach(
      (i) => {
        this.store.set(`players[${i}].x`, this.gameOptions.startLocation.x);
        this.store.set(`players[${i}].y`, this.gameOptions.startLocation.y);
        this.store.set(`players[${i}].score`, 0);
      },
    );
    this.store.savePersistedState();
    this.store.set('gameStatus', 1);
    this.store.set('gamePaused', false);
    this.store.set('gameWon', false);
    this.generateBoard();
    this.uiEngine.modules.game.startGame();
    this.uiEngine.playSound('start');
    this.uiEngine.refreshDisplay();
    this.nextTurn();
  }

  nextTurn() {
    // Aggregate some numbers.
    const playersData = this.store.get('players');
    const totalPlayersPlayable = playersData.map((e) => (e.alive && e.playable ? 1 : 0)).reduce((a, b) => a + b);
    // Game ended.
    if (totalPlayersPlayable === 0) {
      this.store.set('gameStatus', 2);
      if (!this.store.get('gameWon')) {
        this.uiEngine.modules.game.showGameOverMessage({
          text: 'Game Over',
          fill: 0xff0000,
        });
      }
      return;
    }

    // Increment turn or active player index.
    let currentTurn = this.store.get('currentTurn');
    const currentActivePlayer = this.store.get('currentActivePlayer');
    const nextActivePlayer = this.getClosestActivePlayer(currentActivePlayer + 1);
    // Increase turn as needed.
    if (nextActivePlayer <= currentActivePlayer) {
      currentTurn += 1;
      this.store.set('currentTurn', currentTurn);
      const scoreReductionMultiplier = 2 ** (3 - this.store.get('mapDifficulty'));
      this.store.set('currentScore', Math.max(0,
        this.gameOptions.maxScore - currentTurn * scoreReductionMultiplier));
    }
    this.store.set('currentActivePlayer', nextActivePlayer);

    [0, 1].forEach((i) => {
      this.store.set(`diceValue[${i}]`, Math.floor(Math.random() * 6) + 1);
    });

    this.uiEngine.modules.game.nextTurn();
  }

  /**
   * Get closest active player index, including current.
   *
   * @param {Number} playerIndex
   * @returns {*}
   */
  getClosestActivePlayer(playerIndex) {
    const playersData = this.store.get('players');
    const playersCount = this.store.get('playersCount');
    for (let i = 0; i < playersCount; i++) {
      const pi = (playerIndex + i) % playersCount;
      if (playersData[pi].alive && playersData[pi].playable) {
        // Player is both alive and playable.
        return pi;
      }
    }
    throw Error('Error: Unable to get next active player.');
  }

  updateCurrentPlayerData(params) {
    const currentActivePlayer = this.store.get('currentActivePlayer');
    this.store.set(`players[${currentActivePlayer}].alive`, params.alive);
    this.store.set(`players[${currentActivePlayer}].x`, params.location.x);
    this.store.set(`players[${currentActivePlayer}].y`, params.location.y);

    // Trigger winning message.
    if (params.location.x === this.gameOptions.endLocation.x && params.location.y === this.gameOptions.endLocation.y) {
      this.updateWinner(currentActivePlayer);
    }
  }

  updateWinner(currentActivePlayer) {
    const playerName = this.store.get(`players.${currentActivePlayer}.name`);

    // Save high score.
    this.store.set(`players[${currentActivePlayer}].playable`, false);
    this.store.set('highScore', Math.max(this.store.get('currentScore'), this.store.get('highScore')));
    this.uiEngine.updateUiMessage('hiScore', { text: `Hi-Score: ${this.store.get('highScore')}` });
    this.store.savePersistedState();

    // Play winning sound.
    this.uiEngine.playSound('win');

    // Display winning message to first winner.
    if (!this.store.get('gameWon')) {
      this.uiEngine.modules.game.showGameOverMessage({
        text: `${playerName} Wins!`,
        fill: this.store.get('gameOptions.playerColors')[currentActivePlayer],
      });
      this.store.set('gameWon', true);
    }
  }
}
