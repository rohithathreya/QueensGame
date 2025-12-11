// Queens Puzzle - Core Game Engine
// Implements region generation, solution generation, and validation logic

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

const CellState = {
  EMPTY: 'EMPTY',
  MARKER: 'MARKER',  // X - cannot contain a queen
  QUEEN: 'QUEEN'
};

const Difficulty = {
  EASY: { name: 'Easy', size: 6 },
  MEDIUM: { name: 'Medium', size: 7 },
  HARD: { name: 'Hard', size: 8 }
};

// High-contrast color palette for easy region differentiation
// Medium-light region colors for the light theme (more contrast)
const REGION_COLORS = [
  '#FFB3B3',  // Soft red
  '#9CC7FF',  // Soft blue
  '#AEE6BF',  // Soft green
  '#FFC977',  // Soft orange/yellow
  '#D2B8FF',  // Soft purple
  '#8FE7E7',  // Soft teal
  '#FFE28A',  // Soft yellow
  '#FFB7DA',  // Soft pink
  '#C9E99C',  // Soft lime
  '#D1B8A0'   // Soft brown/tan
];

// ============================================================================
// GAME STATE
// ============================================================================

class QueensPuzzle {
  constructor(size, regions, solution) {
    this.size = size;
    this.regions = regions;  // 2D array: regions[r][c] = regionId
    this.solution = solution; // 2D array: solution[r][c] = 1 if queen
  }
}

class GameState {
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.cellStates = Array(puzzle.size).fill(null).map(() =>
      Array(puzzle.size).fill(CellState.EMPTY)
    );
    this.mistakes = 0;
    this.startTimeMillis = Date.now();
    this.endTimeMillis = null;
  }

  getCellState(row, col) {
    return this.cellStates[row][col];
  }

  setCellState(row, col, state) {
    this.cellStates[row][col] = state;
  }

  cycleCellState(row, col) {
    const current = this.cellStates[row][col];
    const cycle = {
      [CellState.EMPTY]: CellState.MARKER,
      [CellState.MARKER]: CellState.QUEEN,
      [CellState.QUEEN]: CellState.EMPTY
    };
    this.cellStates[row][col] = cycle[current];
  }

  getElapsedTime() {
    if (this.endTimeMillis) {
      return this.endTimeMillis - this.startTimeMillis;
    }
    return Date.now() - this.startTimeMillis;
  }

  getQueenCount() {
    let count = 0;
    for (let r = 0; r < this.puzzle.size; r++) {
      for (let c = 0; c < this.puzzle.size; c++) {
        if (this.cellStates[r][c] === CellState.QUEEN) {
          count++;
        }
      }
    }
    return count;
  }
}

// ============================================================================
// REGION GENERATION
// ============================================================================

class RegionGenerator {
  constructor(size) {
    this.size = size;
    this.regions = Array(size).fill(null).map(() => Array(size).fill(-1));
  }

  generate() {
    // 1. Place N random seeds
    const seeds = this.placeRandomSeeds();

    // 2. Grow regions via flood-fill
    this.growRegions(seeds);

    // 3. Fill any remaining cells
    this.fillRemaining();

    return this.regions;
  }

  placeRandomSeeds() {
    const seeds = [];
    const used = new Set();

    for (let regionId = 0; regionId < this.size; regionId++) {
      let row, col, key;
      do {
        row = Math.floor(Math.random() * this.size);
        col = Math.floor(Math.random() * this.size);
        key = `${row},${col}`;
      } while (used.has(key));

      used.add(key);
      this.regions[row][col] = regionId;
      seeds.push({ row, col, regionId });
    }

    return seeds;
  }

  growRegions(seeds) {
    // Create frontier queues for each region
    const frontiers = seeds.map(s => [s]);
    let hasGrowth = true;

    while (hasGrowth) {
      hasGrowth = false;

      // Shuffle region order for fairness
      const order = Array.from({ length: this.size }, (_, i) => i);
      this.shuffleArray(order);

      for (const regionId of order) {
        if (frontiers[regionId].length === 0) continue;

        // Pick random cell from frontier
        const idx = Math.floor(Math.random() * frontiers[regionId].length);
        const cell = frontiers[regionId][idx];

        // Try to expand from this cell
        const neighbors = this.getUnassignedNeighbors(cell.row, cell.col);

        if (neighbors.length > 0) {
          const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
          this.regions[neighbor.row][neighbor.col] = regionId;
          frontiers[regionId].push(neighbor);
          hasGrowth = true;
        } else {
          // Remove from frontier if can't expand
          frontiers[regionId].splice(idx, 1);
        }
      }
    }
  }

  fillRemaining() {
    // Fill any unassigned cells with adjacent region
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.regions[r][c] === -1) {
          // Find adjacent assigned cell
          const neighbors = this.getAssignedNeighbors(r, c);
          if (neighbors.length > 0) {
            this.regions[r][c] = neighbors[0].regionId;
          }
        }
      }
    }
  }

  getUnassignedNeighbors(row, col) {
    const neighbors = [];
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of deltas) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isValid(nr, nc) && this.regions[nr][nc] === -1) {
        neighbors.push({ row: nr, col: nc });
      }
    }

    return neighbors;
  }

  getAssignedNeighbors(row, col) {
    const neighbors = [];
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of deltas) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isValid(nr, nc) && this.regions[nr][nc] !== -1) {
        neighbors.push({ row: nr, col: nc, regionId: this.regions[nr][nc] });
      }
    }

    return neighbors;
  }

  isValid(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// ============================================================================
// SOLUTION GENERATION (Backtracking Solver)
// ============================================================================

// ============================================================================
// SOLUTION GENERATOR (Backtracking Solver with Solution Counting)
// ============================================================================

class SolutionGenerator {
  constructor(size, regions) {
    this.size = size;
    this.regions = regions;
    this.solution = Array(size).fill(null).map(() => Array(size).fill(0));
    this.solutionsFound = 0;
    this.maxSolutions = 2; // We only care if counters > 1
    this.usedCols = new Set();
    this.usedRegions = new Set();
  }

  generate() {
    this.solve(0);
    return {
      solution: this.solution, // Returns the last found solution (if any)
      count: this.solutionsFound
    };
  }

  solve(row) {
    if (this.solutionsFound >= this.maxSolutions) return;

    if (row === this.size) {
      if (this.solutionsFound === 0) {
        // Save first solution
        this.firstSolution = this.solution.map(r => [...r]);
      }
      this.solutionsFound++;
      return;
    }

    // Try each column in this row
    // Order doesn't matter for counting, but random helps generation variety
    const cols = Array.from({ length: this.size }, (_, i) => i);
    this.shuffleArray(cols);

    for (const col of cols) {
      if (this.isValidPlacement(row, col)) {
        // Place queen
        this.solution[row][col] = 1;
        this.usedCols.add(col);
        this.usedRegions.add(this.regions[row][col]);

        // Recurse
        this.solve(row + 1);

        // Backtrack
        this.solution[row][col] = 0;
        this.usedCols.delete(col);
        this.usedRegions.delete(this.regions[row][col]);

        if (this.solutionsFound >= this.maxSolutions) return;
      }
    }
  }

  isValidPlacement(row, col) {
    // Check column not used
    if (this.usedCols.has(col)) return false;

    // Check region not used
    if (this.usedRegions.has(this.regions[row][col])) return false;

    // Check no adjacent queens (8-neighborhood)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (this.isValid(nr, nc) && this.solution[nr][nc] === 1) {
          return false;
        }
      }
    }

    return true;
  }

  isValid(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// ============================================================================
// LOGICAL SOLVER (Deterministic, step-traceable)
// ============================================================================

class LogicalSolver {
  constructor(size, regions, targetSolution = null) {
    this.size = size;
    this.regions = regions;
    this.targetSolution = targetSolution;
    // 0 = Unknown, 1 = Queen, -1 = Crossed Out (X)
    this.board = Array(size).fill(null).map(() => Array(size).fill(0));
    this.steps = [];
  }

  clone() {
    const next = new LogicalSolver(this.size, this.regions, this.targetSolution);
    next.board = this.board.map(r => [...r]);
    return next;
  }

  // Difficulty scoring – higher means more reasoning was required
  getDifficultyScore() {
    const weights = {
      PLACE_QUEEN_ROW: 1,
      PLACE_QUEEN_COL: 1,
      PLACE_QUEEN_REGION: 1,
      POINTING_ELIMINATION: 2,
      NISHIO_ELIMINATION: 3
    };
    return this.steps.reduce((acc, step) => acc + (weights[step.type] || 0), 0);
  }

  usedAdvancedStep() {
    return this.steps.some(step => step.type === 'NISHIO_ELIMINATION');
  }

  isValidCell(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  isCandidate(row, col) {
    return this.board[row][col] === 0;
  }

  setQueen(row, col, reason, type = 'PLACE_QUEEN') {
    const cell = this.board[row][col];
    if (cell === 1) return { changed: false };
    if (cell === -1) return { contradiction: true };

    this.board[row][col] = 1;
    this.steps.push({ type, row, col, reason });

    const cross = this.crossOutFromQueen(row, col);
    if (cross.contradiction) return { contradiction: true };
    return { changed: true };
  }

  setImpossible(row, col, reason, type = 'ELIMINATE') {
    const cell = this.board[row][col];
    if (cell === 1) return { contradiction: true };
    if (cell === -1) return { changed: false };

    this.board[row][col] = -1;
    if (reason) {
      this.steps.push({ type, row, col, reason });
    }
    return { changed: true };
  }

  crossOutFromQueen(row, col) {
    let changed = false;
    const mark = (r, c) => {
      const res = this.setImpossible(r, c);
      if (res.contradiction) return res;
      if (res.changed) changed = true;
      return null;
    };

    // Row & column
    for (let c = 0; c < this.size; c++) {
      if (c === col) continue;
      const res = mark(row, c);
      if (res && res.contradiction) return { contradiction: true };
    }
    for (let r = 0; r < this.size; r++) {
      if (r === row) continue;
      const res = mark(r, col);
      if (res && res.contradiction) return { contradiction: true };
    }

    // Neighbors (no touching)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (!this.isValidCell(nr, nc)) continue;
        const res = mark(nr, nc);
        if (res && res.contradiction) return { contradiction: true };
      }
    }

    // Region
    const regionId = this.regions[row][col];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (r === row && c === col) continue;
        if (this.regions[r][c] !== regionId) continue;
        const res = mark(r, c);
        if (res && res.contradiction) return { contradiction: true };
      }
    }

    return { changed };
  }

  rowInfo(row) {
    let queens = 0;
    const candidates = [];
    for (let c = 0; c < this.size; c++) {
      const cell = this.board[row][c];
      if (cell === 1) queens++;
      else if (cell === 0) candidates.push({ r: row, c });
    }
    return { queens, candidates };
  }

  colInfo(col) {
    let queens = 0;
    const candidates = [];
    for (let r = 0; r < this.size; r++) {
      const cell = this.board[r][col];
      if (cell === 1) queens++;
      else if (cell === 0) candidates.push({ r, c: col });
    }
    return { queens, candidates };
  }

  regionInfo(regionId) {
    let queens = 0;
    const candidates = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.regions[r][c] !== regionId) continue;
        const cell = this.board[r][c];
        if (cell === 1) queens++;
        else if (cell === 0) candidates.push({ r, c });
      }
    }
    return { queens, candidates };
  }

  applyCoreEliminations() {
    let changed = false;

    // Enforce existing queens onto the grid
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 1) {
          const res = this.crossOutFromQueen(r, c);
          if (res.contradiction) return { contradiction: true };
          if (res.changed) changed = true;
        }
      }
    }

    const singles = this.placeHiddenSingles();
    if (singles.contradiction) return { contradiction: true };
    if (singles.changed) changed = true;

    const pointing = this.applyPointingEliminations();
    if (pointing.contradiction) return { contradiction: true };
    if (pointing.changed) changed = true;

    return { changed };
  }

  placeHiddenSingles() {
    let changed = false;

    // Rows
    for (let r = 0; r < this.size; r++) {
      const info = this.rowInfo(r);
      if (info.queens > 1) return { contradiction: true };
      if (info.queens === 0 && info.candidates.length === 0) return { contradiction: true };
      if (info.queens === 0 && info.candidates.length === 1) {
        const res = this.setQueen(info.candidates[0].r, info.candidates[0].c, "Only valid cell in this row", 'PLACE_QUEEN_ROW');
        if (res.contradiction) return { contradiction: true };
        changed = true;
      }
    }

    // Columns
    for (let c = 0; c < this.size; c++) {
      const info = this.colInfo(c);
      if (info.queens > 1) return { contradiction: true };
      if (info.queens === 0 && info.candidates.length === 0) return { contradiction: true };
      if (info.queens === 0 && info.candidates.length === 1) {
        const res = this.setQueen(info.candidates[0].r, info.candidates[0].c, "Only valid cell in this column", 'PLACE_QUEEN_COL');
        if (res.contradiction) return { contradiction: true };
        changed = true;
      }
    }

    // Regions
    const regionCount = this.size; // region ids go from 0..size-1
    for (let rid = 0; rid < regionCount; rid++) {
      const info = this.regionInfo(rid);
      if (info.queens > 1) return { contradiction: true };
      if (info.queens === 0 && info.candidates.length === 0) return { contradiction: true };
      if (info.queens === 0 && info.candidates.length === 1) {
        const res = this.setQueen(info.candidates[0].r, info.candidates[0].c, "Only valid cell in this region", 'PLACE_QUEEN_REGION');
        if (res.contradiction) return { contradiction: true };
        changed = true;
      }
    }

    return { changed };
  }

  applyPointingEliminations() {
    // Sudoku-style "pointing pairs/lines":
    // If all candidates of a region lie in the same row (or column),
    // eliminate other candidates in that row (or column) outside the region.
    let changed = false;
    for (let rid = 0; rid < this.size; rid++) {
      const regionCandidates = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.regions[r][c] !== rid) continue;
          if (this.board[r][c] === 0) regionCandidates.push({ r, c });
        }
      }
      if (regionCandidates.length === 0) continue;

      const rows = new Set(regionCandidates.map(c => c.r));
      const cols = new Set(regionCandidates.map(c => c.c));

      if (rows.size === 1) {
        const row = regionCandidates[0].r;
        for (let c = 0; c < this.size; c++) {
          if (this.regions[row][c] === rid) continue;
          if (!this.isCandidate(row, c)) continue;
          const res = this.setImpossible(row, c, "Region's options confined to this row", 'POINTING_ELIMINATION');
          if (res.contradiction) return { contradiction: true };
          if (res.changed) changed = true;
        }
      }

      if (cols.size === 1) {
        const col = regionCandidates[0].c;
        for (let r = 0; r < this.size; r++) {
          if (this.regions[r][col] === rid) continue;
          if (!this.isCandidate(r, col)) continue;
          const res = this.setImpossible(r, col, "Region's options confined to this column", 'POINTING_ELIMINATION');
          if (res.contradiction) return { contradiction: true };
          if (res.changed) changed = true;
        }
      }
    }
    return { changed };
  }

  attemptNishioElimination(stepLimit) {
    let changed = false;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.isCandidate(r, c)) continue;

        const trial = this.clone();
        const setRes = trial.setQueen(r, c);
        if (setRes.contradiction) {
          const res = this.setImpossible(r, c, "Assumption immediately conflicts", 'NISHIO_ELIMINATION');
          if (res.contradiction) return { contradiction: true };
          if (res.changed) changed = true;
          if (stepLimit && this.steps.length >= stepLimit) return { changed };
          continue;
        }

        const res = trial.solveToFixedPoint({
          allowNishio: true, // allow a deeper logical cascade inside the assumption
          stepLimit: stepLimit || 200
        });
        if (res.contradiction || !trial.isConsistent()) {
          const elim = this.setImpossible(r, c, "Assuming a queen here breaks the puzzle", 'NISHIO_ELIMINATION');
          if (elim.contradiction) return { contradiction: true };
          if (elim.changed) changed = true;
          if (stepLimit && this.steps.length >= stepLimit) return { changed };
        }
      }
    }

    return { changed };
  }

  solveToFixedPoint({ allowNishio = true, stepLimit = null } = {}) {
    let guard = 0;
    const cap = stepLimit ? Math.max(400, stepLimit * 2) : 800;
    while (guard < cap) {
      guard++;
      const elim = this.applyCoreEliminations();
      if (elim.contradiction) return { contradiction: true };
      if (stepLimit && this.steps.length >= stepLimit) return { contradiction: false };

      if (this.isSolved()) return { contradiction: false };

      // If no progress from core rules, try one-step lookahead
      if (!elim.changed) {
        if (allowNishio) {
          const nishio = this.attemptNishioElimination(stepLimit);
          if (nishio.contradiction) return { contradiction: true };
          if (stepLimit && this.steps.length >= stepLimit) return { contradiction: false };
          if (nishio.changed) continue;
        }
        return { contradiction: false };
      }
    }
    return { contradiction: true };
  }

  isConsistent() {
    for (let r = 0; r < this.size; r++) {
      const info = this.rowInfo(r);
      if (info.queens > 1) return false;
      if (info.queens === 0 && info.candidates.length === 0) return false;
    }
    for (let c = 0; c < this.size; c++) {
      const info = this.colInfo(c);
      if (info.queens > 1) return false;
      if (info.queens === 0 && info.candidates.length === 0) return false;
    }
    for (let rid = 0; rid < this.size; rid++) {
      const info = this.regionInfo(rid);
      if (info.queens > 1) return false;
      if (info.queens === 0 && info.candidates.length === 0) return false;
    }
    return true;
  }

  isSolved() {
    // Exactly one queen per row/col/region
    for (let r = 0; r < this.size; r++) {
      if (this.rowInfo(r).queens !== 1) return false;
    }
    for (let c = 0; c < this.size; c++) {
      if (this.colInfo(c).queens !== 1) return false;
    }
    for (let rid = 0; rid < this.size; rid++) {
      if (this.regionInfo(rid).queens !== 1) return false;
    }
    return true;
  }

  matchesTargetSolution() {
    if (!this.targetSolution) return true;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const expected = this.targetSolution[r][c] === 1 ? 1 : -1;
        const cell = this.board[r][c];
        if (expected === 1 && cell !== 1) return false;
        if (expected !== 1 && cell === 1) return false;
      }
    }
    return true;
  }

  solveLogically({ allowNishio = true, stepLimit = null } = {}) {
    const result = this.solveToFixedPoint({ allowNishio, stepLimit });
    if (result.contradiction) {
      return { solved: false, difficultyScore: this.getDifficultyScore(), usedAdvanced: this.usedAdvancedStep(), steps: this.steps };
    }
    if (!this.isSolved()) {
      return { solved: false, difficultyScore: this.getDifficultyScore(), usedAdvanced: this.usedAdvancedStep(), steps: this.steps };
    }
    if (!this.matchesTargetSolution()) {
      return { solved: false, difficultyScore: this.getDifficultyScore(), usedAdvanced: this.usedAdvancedStep(), steps: this.steps };
    }
    return { solved: true, difficultyScore: this.getDifficultyScore(), usedAdvanced: this.usedAdvancedStep(), steps: this.steps };
  }

  getFirstStep() {
    const temp = this.clone();
    temp.solveToFixedPoint({ allowNishio: true, stepLimit: 1 });
    return temp.steps[0] || null;
  }
}

// ============================================================================
// PUZZLE GENERATOR (Main Entry Point)
// ============================================================================

class PuzzleGenerator {
  static generate(difficulty) {
    const size = difficulty.size;
    let attempts = 0;
    const targets = PuzzleGenerator.getDifficultyTargets(difficulty);
    let minScore = targets.minScore;
    let minSteps = targets.minSteps;
    const requireAdvanced = targets.requireAdvanced;
    let fallbackPuzzle = null;
    let fallbackScore = -Infinity;
    let fallbackSteps = -Infinity;
    const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const timeLimitMs = size >= 8 ? 3500 : 2500;
    const stepLimitForGen = size >= 8 ? 400 : null;

    while (attempts < 2000) { // Guard to prevent runaway generation
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (now - start > timeLimitMs) {
        console.warn(`Generation time limit reached (${timeLimitMs}ms) after ${attempts} attempts`);
        break;
      }
      attempts++;

      // 1. Generate random regions
      const regionGen = new RegionGenerator(size);
      const regions = regionGen.generate();

      // 2. Check for unique solution
      const solutionGen = new SolutionGenerator(size, regions);
      const result = solutionGen.generate();

      if (result.count === 1) {
        // 3. Check for logical solvability (no guessing) and difficulty
        const solver = new LogicalSolver(size, regions, solutionGen.firstSolution);
        const logicResult = solver.solveLogically({ stepLimit: stepLimitForGen });

        const meetsDifficulty = logicResult.solved &&
          logicResult.difficultyScore >= minScore &&
          logicResult.steps.length >= minSteps &&
          (!requireAdvanced || logicResult.usedAdvanced);

        if (logicResult.solved && logicResult.difficultyScore > fallbackScore) {
          fallbackPuzzle = new QueensPuzzle(size, regions, solutionGen.firstSolution);
          fallbackScore = logicResult.difficultyScore;
          fallbackSteps = logicResult.steps.length;
        }

        if (meetsDifficulty) {
          console.log(`Generated valid puzzle in ${attempts} attempts (logic score: ${logicResult.difficultyScore}, steps: ${logicResult.steps.length})`);
          return new QueensPuzzle(size, regions, solutionGen.firstSolution);
        }
      }

      // Slightly relax minimum score after many attempts but still keep puzzles non-trivial
      if (attempts === 900 && minScore > targets.minScore - 2) {
        minScore = targets.minScore - 2;
        minSteps = Math.max(4, minSteps - 2);
        console.warn(`Relaxing minimum logic score to ${minScore} and min steps to ${minSteps} after ${attempts} attempts`);
      }
    }

    // If we couldn't hit the target, return the best puzzle we found that was still logically solvable and unique
    if (fallbackPuzzle) {
      console.warn(`Returning best available puzzle after extended search (score ${fallbackScore}, steps ${fallbackSteps})`);
      return fallbackPuzzle;
    }

    throw new Error("Unable to generate a puzzle that meets the strict criteria");
  }

  static getDifficultyTargets(difficulty) {
    const base = difficulty.size;
    const name = difficulty.name.toLowerCase();
    if (name === 'easy') return { minScore: base + 2, minSteps: base + 2, requireAdvanced: false };
    if (name === 'medium') return { minScore: base + 6, minSteps: base + 6, requireAdvanced: true };
    return { minScore: base + 10, minSteps: base + 8, requireAdvanced: true }; // hard and above
  }
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

class Validator {
  constructor(gameState) {
    this.gameState = gameState;
    this.puzzle = gameState.puzzle;
  }

  // Check if current state violates any rules
  getRuleViolations() {
    const violations = {
      rows: new Set(),
      cols: new Set(),
      regions: new Set(),
      adjacentQueens: []
    };

    const queens = this.getQueenPositions();

    // Check row rule
    const rowCounts = new Map();
    for (const q of queens) {
      rowCounts.set(q.row, (rowCounts.get(q.row) || 0) + 1);
    }
    for (const [row, count] of rowCounts) {
      if (count > 1) violations.rows.add(row);
    }

    // Check column rule
    const colCounts = new Map();
    for (const q of queens) {
      colCounts.set(q.col, (colCounts.get(q.col) || 0) + 1);
    }
    for (const [col, count] of colCounts) {
      if (count > 1) violations.cols.add(col);
    }

    // Check region rule
    const regionCounts = new Map();
    for (const q of queens) {
      const regionId = this.puzzle.regions[q.row][q.col];
      regionCounts.set(regionId, (regionCounts.get(regionId) || 0) + 1);
    }
    for (const [region, count] of regionCounts) {
      if (count > 1) violations.regions.add(region);
    }

    // Check adjacency rule
    for (let i = 0; i < queens.length; i++) {
      for (let j = i + 1; j < queens.length; j++) {
        const q1 = queens[i];
        const q2 = queens[j];
        const rowDist = Math.abs(q1.row - q2.row);
        const colDist = Math.abs(q1.col - q2.col);
        if (Math.max(rowDist, colDist) <= 1) {
          violations.adjacentQueens.push([q1, q2]);
        }
      }
    }

    return violations;
  }

  hasViolations() {
    const v = this.getRuleViolations();
    return v.rows.size > 0 || v.cols.size > 0 ||
      v.regions.size > 0 || v.adjacentQueens.length > 0;
  }

  isComplete() {
    const size = this.puzzle.size;
    const queens = this.getQueenPositions();

    // Must have exactly N queens
    if (queens.length !== size) return false;

    // Must have no violations
    if (this.hasViolations()) return false;

    // Check each row has exactly 1 queen
    const rowCounts = new Array(size).fill(0);
    for (const q of queens) rowCounts[q.row]++;
    if (rowCounts.some(c => c !== 1)) return false;

    // Check each column has exactly 1 queen
    const colCounts = new Array(size).fill(0);
    for (const q of queens) colCounts[q.col]++;
    if (colCounts.some(c => c !== 1)) return false;

    // Check each region has exactly 1 queen
    const regionCounts = new Array(size).fill(0);
    for (const q of queens) {
      const regionId = this.puzzle.regions[q.row][q.col];
      regionCounts[regionId]++;
    }
    if (regionCounts.some(c => c !== 1)) return false;

    return true;
  }

  getQueenPositions() {
    const queens = [];
    for (let r = 0; r < this.puzzle.size; r++) {
      for (let c = 0; c < this.puzzle.size; c++) {
        if (this.gameState.cellStates[r][c] === CellState.QUEEN) {
          queens.push({ row: r, col: c });
        }
      }
    }
    return queens;
  }
}

// ============================================================================
// DEDUCTION ENGINE (Hints & Logic)
// ============================================================================

class DeductionEngine {
  constructor(gameState) {
    this.gameState = gameState;
    this.puzzle = gameState.puzzle;
  }

  getHint() {
    // 1. Create a logical solver initialized with the CURRENT user board state
    const solver = new LogicalSolver(this.puzzle.size, this.puzzle.regions);

    // Sync solver state with current game state
    // We treat user's correct moves as facts, but incorrect moves shouldn't block hints (or should point out errors)
    // For a helpful hint system, let's assume valid user moves are "locked in"

    // First, check for immediate errors in user placement
    const violations = new Validator(this.gameState).getRuleViolations();
    if (this.isValidState(violations)) {
      // If state is valid so far, load it into solver
      for (let r = 0; r < this.puzzle.size; r++) {
        for (let c = 0; c < this.puzzle.size; c++) {
          const state = this.gameState.cellStates[r][c];
          if (state === CellState.QUEEN) solver.board[r][c] = 1;
          else if (state === CellState.MARKER) solver.board[r][c] = -1;
        }
      }
    } else {
      // If user has errors, hint should probably be "Fix your errors first"
      // But let's try to find a constructive move ignoring markers, only respecting queens?
      // Simpler: Just try to solve from scratch and see if we can find a move the user hasn't made yet.
      return { message: "You have rule violations! Fix them before getting a hint." };
    }

    // 2. Ask solver for the next logical deduction
    const nextMove = solver.getFirstStep();

    if (nextMove) {
      if (nextMove.type === 'NISHIO_ELIMINATION' || nextMove.type === 'ELIMINATE') {
        return {
          row: nextMove.row,
          col: nextMove.col,
          message: nextMove.reason || "Logic dictates this cell cannot be a queen (Cross it out)."
        };
      } else {
        return {
          row: nextMove.row,
          col: nextMove.col,
          message: nextMove.reason || "This is the only valid spot for a queen here!"
        };
      }
    }

    return { message: "No obvious logical steps found based on current markings. Check your X's!" };
  }

  isValidState(v) {
    return v.rows.size === 0 && v.cols.size === 0 && v.regions.size === 0 && v.adjacentQueens.length === 0;
  }
}


// ============================================================================
// AUTO HELPER (Auto-X Placement)
// ============================================================================

class AutoHelper {
  constructor(gameState) {
    this.gameState = gameState;
    this.puzzle = gameState.puzzle;
  }

  // Get all cells that should be marked X when queen placed at (row, col)
  getImpossibleCells(row, col) {
    const impossible = [];

    // 1. All cells in the same row (except the queen itself)
    for (let c = 0; c < this.puzzle.size; c++) {
      if (c !== col) {
        impossible.push({ row, col: c });
      }
    }

    // 2. All cells in the same column (except the queen itself)
    for (let r = 0; r < this.puzzle.size; r++) {
      if (r !== row) {
        impossible.push({ row: r, col });
      }
    }

    // 3. All 8 neighbors
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < this.puzzle.size && nc >= 0 && nc < this.puzzle.size) {
          impossible.push({ row: nr, col: nc });
        }
      }
    }

    // 4. All other cells in the same region
    const regionId = this.puzzle.regions[row][col];
    for (let r = 0; r < this.puzzle.size; r++) {
      for (let c = 0; c < this.puzzle.size; c++) {
        if (this.puzzle.regions[r][c] === regionId && !(r === row && c === col)) {
          impossible.push({ row: r, col: c });
        }
      }
    }

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const cell of impossible) {
      const key = `${cell.row},${cell.col}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(cell);
      }
    }

    return unique;
  }

  // Apply auto-X to all impossible cells
  applyAutoX(row, col) {
    const impossible = this.getImpossibleCells(row, col);
    for (const cell of impossible) {
      // Only mark as X if currently empty
      if (this.gameState.cellStates[cell.row][cell.col] === CellState.EMPTY) {
        this.gameState.cellStates[cell.row][cell.col] = CellState.MARKER;
      }
    }
  }
}

// ============================================================================
// MOVE HISTORY (Undo/Redo)
// ============================================================================

class MoveHistory {
  constructor() {
    this.moves = []; // Stack of moves
    this.redoStack = []; // Stack for redo
    this.timedMoves = []; // Full history with timestamps for analysis
  }

  recordMove(row, col, oldState, newState) {
    const timestamp = Date.now();
    this.moves.push({ row, col, oldState, newState, timestamp });
    this.timedMoves.push({ row, col, oldState, newState, timestamp });
    this.redoStack = []; // Clear redo stack when new move is made
  }

  undo(gameState) {
    if (this.moves.length === 0) return null;

    const move = this.moves.pop();
    this.redoStack.push(move);
    this.timedMoves.push({ row: move.row, col: move.col, oldState: move.newState, newState: move.oldState, timestamp: Date.now(), isUndo: true });

    // Revert the move
    gameState.cellStates[move.row][move.col] = move.oldState;

    return move;
  }

  redo(gameState) {
    if (this.redoStack.length === 0) return null;

    const move = this.redoStack.pop();
    this.moves.push(move);
    this.timedMoves.push({ row: move.row, col: move.col, oldState: move.oldState, newState: move.newState, timestamp: Date.now(), isRedo: true });

    // Reapply the move
    gameState.cellStates[move.row][move.col] = move.newState;

    return move;
  }

  clear() {
    this.moves = [];
    this.redoStack = [];
    this.timedMoves = [];
  }

  canUndo() {
    return this.moves.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  getTimedMoves() {
    return this.timedMoves;
  }
}

// ============================================================================
// OPTIMAL PATH FINDER (Uniform-Cost Search over Logical Deductions)
// ============================================================================

// Step costs for different deduction types
const STEP_COSTS = {
  PLACE_QUEEN_ROW: 1,      // Hidden single in row - easiest
  PLACE_QUEEN_COL: 1,      // Hidden single in column
  PLACE_QUEEN_REGION: 1,   // Hidden single in region
  POINTING_ELIMINATION: 2, // Pointing pairs/lines - moderate
  NISHIO_ELIMINATION: 4,   // Contradiction-based elimination - hardest
  ELIMINATE: 0             // Basic elimination (consequence of queen placement)
};

class OptimalPathFinder {
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.size = puzzle.size;
    this.regions = puzzle.regions;
    this.solution = puzzle.solution;
  }

  /**
   * Find the minimum-cost logical deduction path to solve the puzzle.
   * Uses uniform-cost search (Dijkstra) over logical states.
   * Returns { path: [...steps], totalCost, queenPlacements: [...] }
   */
  findOptimalPath() {
    // State: board configuration encoded as string
    // We only track queen placements (what truly matters for progress)
    const startSolver = new LogicalSolver(this.size, this.regions, this.solution);
    const startState = this.encodeState(startSolver);

    // Priority queue: [cost, solver, path]
    const pq = [[0, startSolver, []]];
    const visited = new Map(); // state -> min cost to reach it
    visited.set(startState, 0);

    let iterations = 0;
    const maxIterations = 50000; // Safety limit

    while (pq.length > 0 && iterations < maxIterations) {
      iterations++;

      // Pop lowest cost state
      pq.sort((a, b) => a[0] - b[0]);
      const [cost, solver, path] = pq.shift();

      // Check if solved
      if (solver.isSolved()) {
        return {
          path: path,
          totalCost: cost,
          queenPlacements: path.filter(s => s.type.startsWith('PLACE_QUEEN')),
          iterations: iterations
        };
      }

      // Generate all possible next logical steps
      const nextSteps = this.getAllNextSteps(solver);

      for (const step of nextSteps) {
        const newSolver = solver.clone();
        newSolver.steps = []; // Reset steps for clean tracking

        // Apply the step
        let result;
        if (step.type.startsWith('PLACE_QUEEN')) {
          result = newSolver.setQueen(step.row, step.col, step.reason, step.type);
        } else {
          result = newSolver.setImpossible(step.row, step.col, step.reason, step.type);
        }

        if (result.contradiction) continue;

        // Propagate basic eliminations to fixed point (free cost)
        const propResult = newSolver.solveToFixedPoint({ allowNishio: false, stepLimit: 1 });
        if (propResult.contradiction) continue;

        const newState = this.encodeState(newSolver);
        const stepCost = STEP_COSTS[step.type] || 1;
        const newCost = cost + stepCost;

        if (!visited.has(newState) || visited.get(newState) > newCost) {
          visited.set(newState, newCost);
          const newPath = [...path, { ...step, cost: stepCost }];
          pq.push([newCost, newSolver, newPath]);
        }
      }
    }

    // Fallback: use the default solver's path
    const fallbackSolver = new LogicalSolver(this.size, this.regions, this.solution);
    fallbackSolver.solveLogically();
    return {
      path: fallbackSolver.steps.filter(s => s.type.startsWith('PLACE_QUEEN')).map(s => ({ ...s, cost: STEP_COSTS[s.type] || 1 })),
      totalCost: fallbackSolver.getDifficultyScore(),
      queenPlacements: fallbackSolver.steps.filter(s => s.type.startsWith('PLACE_QUEEN')),
      iterations: iterations,
      fallback: true
    };
  }

  /**
   * Get all admissible next logical steps from current state.
   * Only returns queen placements (the meaningful progress steps).
   */
  getAllNextSteps(solver) {
    const steps = [];

    // Check for hidden singles in rows
    for (let r = 0; r < this.size; r++) {
      const info = solver.rowInfo(r);
      if (info.queens === 0 && info.candidates.length === 1) {
        steps.push({
          type: 'PLACE_QUEEN_ROW',
          row: info.candidates[0].r,
          col: info.candidates[0].c,
          reason: 'Only valid cell in row ' + r
        });
      }
    }

    // Check for hidden singles in columns
    for (let c = 0; c < this.size; c++) {
      const info = solver.colInfo(c);
      if (info.queens === 0 && info.candidates.length === 1) {
        steps.push({
          type: 'PLACE_QUEEN_COL',
          row: info.candidates[0].r,
          col: info.candidates[0].c,
          reason: 'Only valid cell in column ' + c
        });
      }
    }

    // Check for hidden singles in regions
    for (let rid = 0; rid < this.size; rid++) {
      const info = solver.regionInfo(rid);
      if (info.queens === 0 && info.candidates.length === 1) {
        steps.push({
          type: 'PLACE_QUEEN_REGION',
          row: info.candidates[0].r,
          col: info.candidates[0].c,
          reason: 'Only valid cell in region ' + rid
        });
      }
    }

    // If no simple singles, try Nishio eliminations that lead to singles
    if (steps.length === 0) {
      const nishioSteps = this.findNishioSteps(solver);
      steps.push(...nishioSteps);
    }

    // Deduplicate by (row, col)
    const seen = new Set();
    return steps.filter(s => {
      const key = `${s.row},${s.col}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  findNishioSteps(solver) {
    const steps = [];

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!solver.isCandidate(r, c)) continue;

        // Try placing queen and see if it leads to contradiction
        const trial = solver.clone();
        const setRes = trial.setQueen(r, c);
        if (setRes.contradiction) {
          // This cell can be eliminated
          steps.push({
            type: 'NISHIO_ELIMINATION',
            row: r,
            col: c,
            reason: 'Placing queen here leads to immediate contradiction'
          });
          continue;
        }

        const propRes = trial.solveToFixedPoint({ allowNishio: false });
        if (propRes.contradiction || !trial.isConsistent()) {
          steps.push({
            type: 'NISHIO_ELIMINATION',
            row: r,
            col: c,
            reason: 'Placing queen here eventually leads to contradiction'
          });
        }
      }
    }

    // After eliminations, check if any singles emerge
    if (steps.length > 0) {
      const testSolver = solver.clone();
      for (const step of steps) {
        testSolver.setImpossible(step.row, step.col);
      }
      const afterElim = this.getAllNextSteps(testSolver);
      // Add queen placements that become available after eliminations
      for (const s of afterElim) {
        if (s.type.startsWith('PLACE_QUEEN')) {
          s.type = 'PLACE_QUEEN_REGION'; // Mark as requiring Nishio first
          s.reason = 'Available after contradiction-based elimination';
        }
      }
    }

    return steps;
  }

  encodeState(solver) {
    // Encode only queen positions (the meaningful state)
    let code = '';
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        code += solver.board[r][c] === 1 ? '1' : '0';
      }
    }
    return code;
  }
}

// ============================================================================
// SKILL ANALYZER (Compare User Path to Optimal)
// ============================================================================

class SkillAnalyzer {
  constructor(puzzle, optimalPath) {
    this.puzzle = puzzle;
    this.optimalPath = optimalPath;
    this.optimalQueenOrder = optimalPath.queenPlacements.map(s => `${s.row},${s.col}`);
    this.optimalCost = optimalPath.totalCost;
  }

  /**
   * Analyze the user's move sequence and compute skill metrics.
   * @param {Array} timedMoves - Array of {row, col, oldState, newState, timestamp, isUndo?, isRedo?}
   * @param {number} totalTimeMs - Total time taken to solve
   * @returns {Object} Analysis results
   */
  analyze(timedMoves, totalTimeMs) {
    const size = this.puzzle.size;

    // Extract user's queen placements in order
    const userQueenPlacements = [];
    const currentQueens = new Set();

    for (const move of timedMoves) {
      const key = `${move.row},${move.col}`;
      if (move.newState === CellState.QUEEN) {
        if (!currentQueens.has(key)) {
          userQueenPlacements.push({
            row: move.row,
            col: move.col,
            timestamp: move.timestamp,
            key: key
          });
          currentQueens.add(key);
        }
      } else if (move.oldState === CellState.QUEEN) {
        // Queen removed
        currentQueens.delete(key);
        // Mark as removed for detour tracking
        userQueenPlacements.push({
          row: move.row,
          col: move.col,
          timestamp: move.timestamp,
          key: key,
          removed: true
        });
      }
    }

    // Count stats
    const undoCount = timedMoves.filter(m => m.isUndo).length;
    const redoCount = timedMoves.filter(m => m.isRedo).length;
    const markerPlacements = timedMoves.filter(m => m.newState === CellState.MARKER && !m.isUndo).length;
    const totalMoves = timedMoves.length;

    // Calculate detours (queen placements that were later removed)
    const finalQueens = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.puzzle.solution[r][c] === 1) {
          finalQueens.add(`${r},${c}`);
        }
      }
    }

    const wrongQueenPlacements = userQueenPlacements.filter(p => !p.removed && !finalQueens.has(p.key));
    const detourCount = userQueenPlacements.filter(p => p.removed).length / 2; // Each detour = place + remove

    // Calculate order similarity (how close to optimal order)
    const userFinalOrder = userQueenPlacements
      .filter(p => !p.removed && finalQueens.has(p.key))
      .map(p => p.key);

    const orderSimilarity = this.calculateOrderSimilarity(userFinalOrder, this.optimalQueenOrder);

    // Calculate user's effective cost
    // Base cost = optimal cost
    // Penalties: undos, wrong placements, detours
    const userEffectiveCost = this.optimalCost +
      (undoCount * 0.5) +
      (detourCount * 2) +
      (wrongQueenPlacements.length * 3);

    // Efficiency ratio (1.0 = optimal, lower = less efficient)
    const efficiency = Math.min(1.0, this.optimalCost / Math.max(userEffectiveCost, this.optimalCost));

    // Time factor
    // Expected time: ~3-5 seconds per queen placement for optimal solver
    const expectedTimeMs = size * 4000; // 4 seconds per queen as baseline
    const timeFactor = Math.min(1.5, Math.max(0.5, expectedTimeMs / Math.max(totalTimeMs, 1000)));

    // Final score (0-100)
    // Score = 100 * efficiency * sqrt(timeFactor) * orderBonus
    const orderBonus = 0.8 + (0.2 * orderSimilarity); // 80-100% based on order
    const rawScore = 100 * efficiency * Math.sqrt(timeFactor) * orderBonus;
    const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    // Skill tier
    const tier = this.getTier(finalScore);

    // Per-move analysis
    const moveAnalysis = this.analyzeMoves(userQueenPlacements, timedMoves);

    return {
      // Core metrics
      score: finalScore,
      tier: tier,

      // Efficiency breakdown
      efficiency: Math.round(efficiency * 100),
      timeFactor: Math.round(timeFactor * 100),
      orderSimilarity: Math.round(orderSimilarity * 100),

      // Stats
      totalTimeMs: totalTimeMs,
      totalMoves: totalMoves,
      queenPlacements: userFinalOrder.length,
      markerPlacements: markerPlacements,
      undoCount: undoCount,
      redoCount: redoCount,
      detourCount: Math.round(detourCount),

      // Comparison to optimal
      optimalCost: this.optimalCost,
      optimalSteps: this.optimalQueenOrder.length,
      userEffectiveCost: Math.round(userEffectiveCost * 10) / 10,

      // Detailed analysis
      moveAnalysis: moveAnalysis
    };
  }

  calculateOrderSimilarity(userOrder, optimalOrder) {
    if (userOrder.length === 0 || optimalOrder.length === 0) return 0;

    // Longest common subsequence ratio
    const lcs = this.longestCommonSubsequence(userOrder, optimalOrder);
    return lcs / Math.max(userOrder.length, optimalOrder.length);
  }

  longestCommonSubsequence(a, b) {
    const m = a.length, n = b.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  analyzeMoves(userQueenPlacements, allMoves) {
    const analysis = [];
    const optimalSet = new Set(this.optimalQueenOrder);

    let optimalIndex = 0;
    for (const placement of userQueenPlacements) {
      if (placement.removed) continue;

      const isCorrectCell = optimalSet.has(placement.key);
      const isOptimalOrder = this.optimalQueenOrder[optimalIndex] === placement.key;

      let verdict;
      if (isOptimalOrder) {
        verdict = 'OPTIMAL';
        optimalIndex++;
      } else if (isCorrectCell) {
        verdict = 'CORRECT_OUT_OF_ORDER';
        // Find where this cell is in optimal order
        const optIdx = this.optimalQueenOrder.indexOf(placement.key);
        if (optIdx >= 0) optimalIndex = Math.max(optimalIndex, optIdx + 1);
      } else {
        verdict = 'WRONG';
      }

      analysis.push({
        row: placement.row,
        col: placement.col,
        verdict: verdict,
        optimalNext: this.optimalQueenOrder[optimalIndex - 1] || null
      });
    }

    return analysis;
  }

  getTier(score) {
    if (score >= 95) return { name: 'Grandmaster', emoji: '👑', color: '#FFD700' };
    if (score >= 85) return { name: 'Expert', emoji: '🏆', color: '#C0C0C0' };
    if (score >= 70) return { name: 'Advanced', emoji: '⭐', color: '#CD7F32' };
    if (score >= 50) return { name: 'Intermediate', emoji: '📈', color: '#4CAF50' };
    if (score >= 30) return { name: 'Beginner', emoji: '🌱', color: '#2196F3' };
    return { name: 'Novice', emoji: '🎯', color: '#9E9E9E' };
  }
}
