// Local view data.
const data = {
  prob: [],
};

export default class RwbAi {
  constructor(store) {
    this.store = store;
  }

  getInitialProbabilities() {
    // Refresh local tiles data.
    data.mapTilesData = this.store.get('mapTiles');
    data.gridCountX = data.mapTilesData.length;
    data.gridCountY = data.mapTilesData[0].length;
    data.endLocation = this.store.get('endLocation');

    // First iteration based on chance to land on end location.
    const endLocationXy = [data.endLocation.x, data.endLocation.y];
    const prob = [];
    [...Array(data.gridCountX).keys()].forEach((x) => {
      prob[x] = [];
      [...Array(data.gridCountY).keys()].forEach((y) => {
        if (!RwbAi.isTileWalkable(x, y)) {
          prob[x][y] = 0;
        } else {
          prob[x][y] = RwbAi.getMoveProbability(1, [x, y], endLocationXy);
        }
      });
    });
    return prob;
  }

  getIteratedProbabilities(prob, cycles = 3) {
    // Refresh local tiles data.
    data.mapTilesData = this.store.get('mapTiles');
    data.gridCountX = data.mapTilesData.length;
    data.gridCountY = data.mapTilesData[0].length;

    // First iteration based on end location.
    let probCurrent = prob;
    let probPrevious;
    [...Array(cycles).keys()].forEach(() => {
      probPrevious = probCurrent;
      probCurrent = [];
      [...Array(data.gridCountX).keys()].forEach((x) => {
        probCurrent[x] = [];
        [...Array(data.gridCountY).keys()].forEach((y) => {
          probCurrent[x][y] = RwbAi.getTileMeanExpectations([x, y], probPrevious);
        });
      });
    });

    return probCurrent;
  }

  getMapProbabilities(cycles = 3) {
    // Given map, end location, and knowing that we can use 2 dice values.
    const prob = this.getInitialProbabilities();

    // Do 5 iterations and see what happens.
    data.prob = this.getIteratedProbabilities(prob, cycles);

    return data.prob;
  }

  static getPossibleMoves(xy0, dice1, dice2) {
    // Examples: [{move: null, xy: []}]
    const possibleMoves = [];

    // Try the 4 flying directions.
    const sum = dice1 + dice2;
    [
      ['Up', 0, -sum],
      ['Down', 0, sum],
      ['Left', -sum, 0],
      ['Right', sum, 0],
    ].forEach(([dir, x, y]) => {
      if (RwbAi.isTileWalkable(xy0[0] + x, xy0[1] + y)) {
        possibleMoves.push({
          dirs: [dir, dir],
          values: [dice1, dice2],
          xy: [xy0[0] + x, xy0[1] + y],
        });
      }
    });

    // Try directions with turning.
    // Including using transposed dices.
    [[dice1, dice2], [dice2, dice1]].forEach(([u0, u1]) => {
      [
        [['Up', 'Down'], -u0, u1, 1, 1],
        [['Down', 'Up'], u0, -u1, 1, 1],
        [['Left', 'Right'], -u0, u1, 0, 0],
        [['Right', 'Left'], u0, -u1, 0, 0],
        [['Up', 'Left'], -u0, -u1, 1, 0],
        [['Up', 'Right'], -u0, u1, 1, 0],
        [['Down', 'Left'], u0, -u1, 1, 0],
        [['Down', 'Right'], u0, u1, 1, 0],
        [['Left', 'Up'], -u0, -u1, 0, 1],
        [['Left', 'Down'], -u0, u1, 0, 1],
        [['Right', 'Up'], u0, -u1, 0, 1],
        [['Right', 'Down'], u0, u1, 0, 1],
      ].forEach(([dirs, v0, v1, dirIndex1, dirIndex2]) => {
        const xy1 = [...xy0];
        xy1[dirIndex1] += v0;
        const xy2 = [...xy1];
        xy2[dirIndex2] += v1;
        // Bad targets.
        if (!RwbAi.isTileWalkable(xy1[0], xy1[1]) || !RwbAi.isTileWalkable(xy2[0], xy2[1])) {
          return;
        }
        // Paths blocked.
        if (!RwbAi.isPathClear(xy0, xy1, dirIndex1) || !RwbAi.isPathClear(xy1, xy2, dirIndex2)) {
          return;
        }
        // Valid move.
        possibleMoves.push({
          dirs,
          values: [Math.abs(v0), Math.abs(v1)],
          xy: xy2,
        });
      });
    });

    return possibleMoves;
  }

  /**
   * For given current tile and prob distribution, find expected mean winning probability after next move.
   * 1 = win. 0 = no way to win.
   *
   * @param {Number[]} xy0 [x, y] location at start of current turn.
   * @param {Number[]} prob Current probability distribution as 2D box array.
   */
  static getTileMeanExpectations(xy0, prob) {
    // If tile is a water tile, then it has already lost.
    if (!RwbAi.isTileWalkable(xy0[0], xy0[1])) {
      return 0;
    }
    // If tile is already at 1, then no change as the game is already won.
    if (prob[xy0[0]][xy0[1]] === 1) {
      return 1;
    }
    // Holds expectations (of best moves) for all possible moves from xy0.
    const moveExpectations = [];
    [...Array(6).keys()].forEach((d1) => {
      // Dice values 1-6.
      const dice1 = d1 + 1;
      [...Array(d1).keys()].forEach((d2) => {
        // Dice values 1-6, up to dice1 value.
        const dice2 = d2 + 1;

        // Compute results of all possible moves, and take the best.
        const possibleMoves = RwbAi.getPossibleMoves(xy0, dice1, dice2);
        const possibleMovesProb = possibleMoves.map((pm) => prob[pm.xy[0]][pm.xy[1]]);
        const bestExpectation = possibleMovesProb.length ? possibleMovesProb.reduce((a, b) => Math.max(a, b)) : 0;

        // All asymmetric rolls have double prob of happening.
        moveExpectations.push(bestExpectation);
        if (dice2 !== dice1) {
          moveExpectations.push(bestExpectation);
        }
      });
    });
    // Return mean expectations for current tile.
    return moveExpectations.reduce((a, b) => a + b) / moveExpectations.length;
  }

  /**
   * Get scaled winning probability based on target prob and chance to land on target.
   *
   * @param destProb
   * @param xy0
   * @param xy1
   * @returns {number}
   */
  static getMoveProbability(destProb, xy0, xy1) {
    // Already at dest.
    if (xy0[0] === xy1[0] && xy0[1] === xy1[1]) {
      return destProb;
    }

    const distX = Math.abs(xy1[0] - xy0[0]);
    const distY = Math.abs(xy1[1] - xy0[1]);
    let prob = 0;

    // Impossible move.
    if (distX > 12 || distY > 12) {
      return 0;
    }

    // Simple angled move, simply find out if 1 or both paths are blocked.
    if (distX > 0 && distY > 0) {
      // Another impossible move.
      if (distX > 6 || distY > 6) {
        return 0;
      }
      let multiplier = 0;
      // Move X, then Y.
      if (RwbAi.isPathClear(xy0, xy1, 0) && RwbAi.isPathClear(xy1, xy0, 1)) {
        multiplier += 1;
      }
      // Move Y, then X.
      if (RwbAi.isPathClear(xy0, xy1, 1) && RwbAi.isPathClear(xy1, xy0, 0)) {
        multiplier += 1;
      }
      return multiplier / 36 * destProb;
    }
    // Straight move. We'll need water distances.
    let walkableAhead;
    let walkableBehind;
    if (distY === 0) {
      // Get X prob.
      [walkableAhead, walkableBehind] = RwbAi.getWalkDistances(xy0, xy1, 0);
      prob = Math.max(prob, RwbAi.getLinearMoveProbability(destProb, distX, walkableAhead, walkableBehind));
    }
    if (distX === 0) {
      // Get Y prob.
      [walkableAhead, walkableBehind] = RwbAi.getWalkDistances(xy0, xy1, 1);
      prob = Math.max(prob, RwbAi.getLinearMoveProbability(destProb, distY, walkableAhead, walkableBehind));
    }
    return prob;
  }

  static isPathClear(xy0, xy1, directionIndex = 0) {
    const max = Math.max(xy0[directionIndex], xy1[directionIndex]);
    const min = Math.min(xy0[directionIndex], xy1[directionIndex]);
    for (let i = max; i >= min; i--) {
      if (directionIndex === 0 && data.mapTilesData[i][xy0[1]].type === 'water') {
        return false;
      }
      if (data.mapTilesData[xy0[0]][i].type === 'water') {
        return false;
      }
    }
    return true;
  }

  static isTileWalkable(x, y) {
    if (x < 0 || x >= data.gridCountX || y < 0 || y >= data.gridCountY) {
      return false;
    }
    return data.mapTilesData[x][y].type !== 'water';
  }

  /**
   * Get distance forward/backward to furthest walkable tile.
   *
   * @param {Number[]} xy0
   * @param {Number[]} xy1
   * @param {Number} directionIndex 0 for x direction, 1 for y direction.
   * @returns {number[]}
   */
  static getWalkDistances(xy0, xy1, directionIndex = 0) {
    const [dist0, dist1] = [1, -1].map((increment) => {
      let x;
      let y;
      for (let i = 1; i <= 12; i++) {
        [x, y] = xy0;
        if (directionIndex === 0) {
          x += i * increment;
        } else {
          y += i * increment;
        }
        if (!RwbAi.isTileWalkable(x, y)) {
          return i - 1;
        }
      }
      return 12;
    });
    // Flip ahead and behind based on direction.
    return (xy1[directionIndex] >= xy0[directionIndex]) ? [dist0, dist1] : [dist1, dist0];
  }

  /**
   * Calculate reduced winning probability for current tile based on target tile prob.
   *
   * @param {Number} destProb     (0-1) Winning probability at destination tile. -0 if dest is water. 1 if battery.
   * @param {Number} distAhead    Forward distance to destination.
   * @param {Number} walkableAhead   Number of moves toward destination before first hitting water.
   * @param {Number} walkableBehind    Number of moves backward before hitting water.
   */
  static getLinearMoveProbability(destProb, distAhead, walkableAhead, walkableBehind) {
    // Too far.
    if (distAhead > 12) {
      return 0;
    }
    // Destination has no winning prob assigned.
    if (destProb <= 0) {
      return 0;
    }
    let multiplier;
    if (distAhead >= 6 || walkableAhead < distAhead) {
      // Cases that require flying with two moves in the same direction.
      // 12: 66
      // 11: 56, 65
      // 10: 46, 55, 64
      // ...
      // 7: 16, 25, 34, 43, 52, 61
      // 6: 15, 24, 33, 42, 51
      // 5: 14, 23, 32, 41
      // ...
      // 2: 11
      multiplier = (distAhead > 6) ? (13 - distAhead) : (distAhead - 1);
    } else {
      // Two moves possibly not in the same direction.
      // We'll get room for back-stepping/overshooting first.
      const extraSpace = Math.max(walkableBehind, walkableAhead - distAhead);
      if (distAhead === 0) {
        // Two moves absolutely not in the same direction.
        // 0: 11, 22, 33, 44, 55, 66
        multiplier = Math.min(6, extraSpace);
      } else {
        // Back-stepping + Flying
        // 5: (16), 61; +4 from flying
        // 4: 15, (26), 62, 51; +3
        // 3: 14, 25, (36), 63, 52, 41; +2
        // 2: +8; + 1
        // 1: +10; + 0
        multiplier = 2 * Math.min(6 - distAhead, extraSpace) + (distAhead - 1);
      }
    }
    // Scale back by 36 possible roll combos.
    return multiplier / 36 * destProb;
  }

  pickMove(xy0, dice1, dice2, explorationChance = 0) {
    const possibleMoves = RwbAi.getPossibleMoves(xy0, dice1, dice2);
    // No legal moves.
    if (possibleMoves.length === 0) {
      // Just go towards the right... into water or out of bounds.
      return {
        dirs: ['Right', 'Right'],
        values: [dice1, dice2],
      };
    }

    // Random move.
    if (Math.random() < explorationChance) {
      return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    }

    // Make move based on probability distribution.
    const probDistribution = this.store.get('probDistribution');
    const possibleMovesMapped = possibleMoves.map((pm) => ({ prob: probDistribution[pm.xy[0]][pm.xy[1]], ...pm }));
    return possibleMovesMapped.reduce((a, b) => (a.prob > b.prob ? a : b));
  }
}
