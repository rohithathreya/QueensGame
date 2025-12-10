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
// LOGICAL SOLVER (Ensures No Guessing)
// ============================================================================

class LogicalSolver {
  constructor(size, regions) {
    this.size = size;
    this.regions = regions;
    // 0 = Unknown, 1 = Queen, -1 = Crossed Out (X)
    this.board = Array(size).fill(null).map(() => Array(size).fill(0));
  }

  // Returns true if fully solvable without guessing
  isSolvable() {
    let changed = true;
    while (changed) {
      changed = false;
      changed |= this.applyBasicRules();
      if (!changed) {
        // If stuck, check if completed
        if (this.isSolved()) return true;
        // TODO: Add advanced lookahead if needed, but basic rules cover "no guessing" mostly.
        // For a strictly "no guessing" puzzle we usually want it solvable by basics.
        return false;
      }
    }
    return this.isSolved();
  }

  isSolved() {
    let queens = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 1) queens++;
      }
    }
    return queens === this.size;
  }

  applyBasicRules() {
    let changed = false;

    // 1. Cross out impossible cells (neighbors of queens, same row/col/region)
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 1) {
          changed |= this.crossOutInvalid(r, c);
        }
      }
    }

    // 2. Find singles (only one spot left in Row, Col, or Region)
    changed |= this.findHiddenSingles();

    return changed;
  }

  crossOutInvalid(row, col) {
    let changed = false;
    const regionId = this.regions[row][col];

    // Cross Row, Col, Region, Neighbors
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] !== 0) continue; // Already set

        let isInvalid = false;
        if (r === row && c !== col) isInvalid = true; // Review row
        else if (c === col && r !== row) isInvalid = true; // Review col
        else if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1 && !(r === row && c === col)) isInvalid = true; // Review neighbors
        else if (this.regions[r][c] === regionId && !(r === row && c === col)) isInvalid = true; // Review region

        if (isInvalid) {
          this.board[r][c] = -1; // Cross out
          changed = true;
        }
      }
    }
    return changed;
  }

  findHiddenSingles() {
    let changed = false;

    // Rows
    for (let r = 0; r < this.size; r++) {
      const candidates = [];
      for (let c = 0; c < this.size; c++) if (this.board[r][c] === 0) candidates.push({ r, c });
      // If row has no queen and exactly 1 candidate
      if (candidates.length === 1 && !this.rowHasQueen(r)) {
        this.board[candidates[0].r][candidates[0].c] = 1;
        changed = true;
      }
    }

    // Cols
    for (let c = 0; c < this.size; c++) {
      const candidates = [];
      for (let r = 0; r < this.size; r++) if (this.board[r][c] === 0) candidates.push({ r, c });
      if (candidates.length === 1 && !this.colHasQueen(c)) {
        this.board[candidates[0].r][candidates[0].c] = 1;
        changed = true;
      }
    }

    // Regions
    const regionCells = {};
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const rid = this.regions[r][c];
        if (!regionCells[rid]) regionCells[rid] = [];
        if (this.board[r][c] === 0) regionCells[rid].push({ r, c });
      }
    }
    for (const rid in regionCells) {
      if (regionCells[rid].length === 1 && !this.regionHasQueen(parseInt(rid))) {
        const cell = regionCells[rid][0];
        this.board[cell.r][cell.c] = 1;
        changed = true;
      }
    }

    return changed;
  }

  rowHasQueen(r) { return this.board[r].some(val => val === 1); }
  colHasQueen(c) { return this.board.map(row => row[c]).some(val => val === 1); }
  regionHasQueen(rid) {
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++)
        if (this.regions[r][c] === rid && this.board[r][c] === 1) return true;
    return false;
  }
}

// ============================================================================
// PUZZLE GENERATOR (Main Entry Point)
// ============================================================================

class PuzzleGenerator {
  static generate(difficulty) {
    const size = difficulty.size;
    let attempts = 0;

    while (attempts < 1000) { // Safety break
      attempts++;

      // 1. Generate random regions
      const regionGen = new RegionGenerator(size);
      const regions = regionGen.generate();

      // 2. Check for unique solution
      const solutionGen = new SolutionGenerator(size, regions);
      const result = solutionGen.generate();

      if (result.count === 1) {
        // 3. Check for logical solvability (no guessing)
        const solver = new LogicalSolver(size, regions);
        if (solver.isSolvable()) {
          console.log(`Generated valid puzzle in ${attempts} attempts`);
          return new QueensPuzzle(size, regions, solutionGen.firstSolution);
        }
      }
    }

    // Fallback if strict generation too hard (shouldn't happen often for small sizes)
    console.warn("Failed to generate strict puzzle, retrying...");
    return PuzzleGenerator.generate(difficulty);
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
    // We modify the solver to return the *first* change it makes
    const nextMove = solver.findNextMove();

    if (nextMove) {
      if (nextMove.type === 'CROSS_OUT') {
        return {
          row: nextMove.row,
          col: nextMove.col,
          message: "Logic dictates this cell cannot be a queen (Cross it out)."
        };
      } else if (nextMove.type === 'PLACE_QUEEN') {
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

// Extend LogicalSolver to support single-step lookahead for hints
LogicalSolver.prototype.findNextMove = function () {
  // 1. Check for immediate cross-outs (Basic Rules)
  for (let r = 0; r < this.size; r++) {
    for (let c = 0; c < this.size; c++) {
      if (this.board[r][c] === 1) {
        const changed = this.crossOutInvalid(r, c); // This updates internal state, but we want to catch WHICH one
        // Actually, let's re-implement a sensing version just for the hint
        const moves = this.getCrossOutsFor(r, c);
        if (moves.length > 0) return { type: 'CROSS_OUT', row: moves[0].r, col: moves[0].c };
      }
    }
  }

  // 2. Check for hidden singles
  const single = this.getHiddenSingle();
  if (single) return { type: 'PLACE_QUEEN', row: single.r, col: single.c, reason: single.reason };

  return null;
};

LogicalSolver.prototype.getCrossOutsFor = function (row, col) {
  const moves = [];
  const regionId = this.regions[row][col];
  for (let r = 0; r < this.size; r++) {
    for (let c = 0; c < this.size; c++) {
      if (this.board[r][c] !== 0) continue;
      let isInvalid = false;
      if (r === row && c !== col) isInvalid = true;
      else if (c === col && r !== row) isInvalid = true;
      else if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1 && !(r === row && c === col)) isInvalid = true;
      else if (this.regions[r][c] === regionId && !(r === row && c === col)) isInvalid = true;

      if (isInvalid) moves.push({ r, c });
    }
  }
  return moves;
};

LogicalSolver.prototype.getHiddenSingle = function () {
  // Rows
  for (let r = 0; r < this.size; r++) {
    const candidates = [];
    for (let c = 0; c < this.size; c++) if (this.board[r][c] === 0) candidates.push({ r, c });
    if (candidates.length === 1 && !this.rowHasQueen(r)) return { ...candidates[0], reason: "Only valid spot in this row" };
  }
  // Cols
  for (let c = 0; c < this.size; c++) {
    const candidates = [];
    for (let r = 0; r < this.size; r++) if (this.board[r][c] === 0) candidates.push({ r, c });
    if (candidates.length === 1 && !this.colHasQueen(c)) return { ...candidates[0], reason: "Only valid spot in this column" };
  }
  // Regions
  const regionCells = {};
  for (let r = 0; r < this.size; r++) {
    for (let c = 0; c < this.size; c++) {
      const rid = this.regions[r][c];
      if (!regionCells[rid]) regionCells[rid] = [];
      if (this.board[r][c] === 0) regionCells[rid].push({ r, c });
    }
  }
  for (const rid in regionCells) {
    if (regionCells[rid].length === 1 && !this.regionHasQueen(parseInt(rid))) {
      return { ...regionCells[rid][0], reason: "Only valid spot in this region" };
    }
  }
  return null;
};

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
