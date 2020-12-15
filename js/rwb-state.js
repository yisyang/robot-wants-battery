import { get as deepGet, has as deepHas, set as deepSet } from 'lodash-es';

export default class RwbState {
  constructor(defaultState = {}) {
    this.defaultState = defaultState;

    // Game state contains ALL state info for the game in progress,
    // and can be used to re-render the game board.
    this.state = {};
    this.reset();

    // Overwrite with persisted state across sessions.
    this.loadPersistedState();
  }

  countPlayersAtLocation(x, y) {
    let cnt = 0;
    for (let i = 0; i < this.state.playersCount; i++) {
      if (this.state.players[i].x === x && this.state.players[i].y === y) {
        cnt += 1;
      }
    }
    return cnt;
  }

  countPlayersAtPlayerLocation(i) {
    return this.countPlayersAtLocation(this.state.players[i].x, this.state.players[i].y);
  }

  get(key, fallback = null) {
    return deepGet(this.state, key, fallback);
  }

  has(key) {
    return deepHas(this.state, key);
  }

  loadPersistedState() {
    this.state.mapDifficulty = window.localStorage.getItem('mapDifficulty') || 1;
    this.state.highScore = window.localStorage.getItem('highScore') || 0;
  }

  reset() {
    this.state = Object.assign(this.defaultState, {
      currentTurn: 0,
      currentActivePlayer: -1, // Hack
      gameStatus: 0, // 0: Not started, 1: Started, 2: Done
      highScore: 0,
      mapSeed: '',
      mapDifficulty: 1,
      playersCount: 1,
      players: [
        {
          controller: 'human', // human, ai-easy, ai-hard
          name: 'Player 1',
          alive: false,
          score: 0,
        },
        {
          controller: 'none',
          name: 'Player 2',
          alive: false,
          score: 0,
        },
        {
          controller: 'none',
          name: 'Player 3',
          alive: false,
          score: 0,
        },
        {
          controller: 'none',
          name: 'Player 4',
          alive: false,
          score: 0,
        },
      ],
      playerLocations: [],
      mapTiles: [],
    });
  }

  savePersistedState() {
    window.localStorage.setItem('mapDifficulty', this.state.mapDifficulty);
    window.localStorage.setItem('highScore', this.state.highScore);
  }

  set(key, data) {
    if (key.substr(0, 12) === 'gameOptions.') {
      throw Error('Blocked attempt to change game options from game state.');
    }
    console.log('ok');
    deepSet(this.state, key, data);
  }
}
