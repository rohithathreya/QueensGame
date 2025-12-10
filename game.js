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
const REGION_COLORS = [
  '#FF3B30',  // Red
  '#007AFF',  // Blue
  '#34C759',  // Green
  '#FF9500',  // Orange
  '#AF52DE',  // Purple
  '#00C7BE',  // Cyan/Teal
  '#FFCC00',  // Yellow
  '#FF2D92',  // Magenta/Pink
  '#8BC34A',  // Lime
  '#795548'   // Brown
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
  }

  recordMove(row, col, oldState, newState) {
    this.moves.push({ row, col, oldState, newState });
    this.redoStack = []; // Clear redo stack when new move is made
  }

  undo(gameState) {
    if (this.moves.length === 0) return null;

    const move = this.moves.pop();
    this.redoStack.push(move);

    // Revert the move
    gameState.cellStates[move.row][move.col] = move.oldState;

    return move;
  }

  redo(gameState) {
    if (this.redoStack.length === 0) return null;

    const move = this.redoStack.pop();
    this.moves.push(move);

    // Reapply the move
    gameState.cellStates[move.row][move.col] = move.newState;

    return move;
  }

  clear() {
    this.moves = [];
    this.redoStack = [];
  }

  canUndo() {
    return this.moves.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}
