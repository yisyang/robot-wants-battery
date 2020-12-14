import { get as deepGet, has as deepHas, set as deepSet } from 'lodash-es';

export default class RwbState {
  constructor(defaultState = {}) {
    this.defaultState = defaultState;

    // Persisted state across sessions.
    this.persistedState = {};
    this.loadPersistedState();

    // Game state contains ALL state info for the game in progress,
    // and can be used to re-render the game board.
    this.state = {};
    this.reset();
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
    this.persistedState.mapDifficulty = window.localStorage.getItem('difficulty') || 1;
    this.persistedState.highScore = window.localStorage.getItem('highScore') || 0;
  }

  reset() {
    this.state = Object.assign(this.defaultState, {
      currentTurn: 0,
      currentActivePlayer: 0,
      mapSeed: '',
      mapDifficulty: this.persistedState.mapDifficulty,
      playersCount: 4,
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
    window.localStorage.setItem('difficulty', this.persistedState.mapDifficulty);
    window.localStorage.setItem('highScore', this.persistedState.highScore);
  }

  set(key, data) {
    deepSet(this.state, key, data);
  }
}
