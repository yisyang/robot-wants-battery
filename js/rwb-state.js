/* eslint-disable class-methods-use-this */

import { get as deepGet, has as deepHas, set as deepSet } from 'lodash-es';

// Game state contains ALL state info for the game in progress,
// and can be used to re-render the game board.
// Putting this out of class to prevent direct access without getter/setter.
const state = {
  diceValue: [0, 0],
  highScore: 0,
  mapSeed: '',
  mapDifficulty: 1,
  playersCount: 1,
  players: [
    {
      controller: 1, // 0: none, 1: human, 2: ai-easy, 3: ai-hard, 4: open (remote)
      name: 'Player 1',
      alive: false,
      playable: false,
    },
    {
      controller: 0,
      name: 'Player 2',
    },
    {
      controller: 0,
      name: 'Player 3',
    },
    {
      controller: 0,
      name: 'Player 4',
    },
  ],
};

export default class RwbState {
  constructor(defaultState = {}) {
    this.defaultState = defaultState;

    this.reset();

    // Overwrite with persisted state across sessions.
    this.loadPersistedState();
  }

  get(key, fallback = null) {
    return deepGet(state, key, fallback);
  }

  has(key) {
    return deepHas(state, key);
  }

  loadPersistedState() {
    state.mapDifficulty = parseInt(window.localStorage.getItem('mapDifficulty'), 10) || 1;
    state.highScore = parseInt(window.localStorage.getItem('highScore'), 10) || 0;
  }

  reset() {
    Object.assign(state, {
      ...this.defaultState,
      currentTurn: 0,
      currentActivePlayer: -1, // Hack
      gameStatus: 0, // 0: Not started, 1: Started, 2: Done
      gamePaused: false,
      gameWon: false,
      mapSeed: '',
      mapTiles: [],
    });
  }

  savePersistedState() {
    window.localStorage.setItem('mapDifficulty', state.mapDifficulty);
    window.localStorage.setItem('highScore', state.highScore);
  }

  set(key, data) {
    if (key.substr(0, 12) === 'gameOptions.') {
      throw Error('Blocked attempt to change game options from game state.');
    }
    deepSet(state, key, data);
  }
}
