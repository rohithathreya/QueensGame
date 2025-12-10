// ============================================================================
// QUEENS PUZZLE - WORLD CLASS COACHING ENGINE
// ============================================================================
// A comprehensive coaching system that:
// 1. Tracks pattern recognition proficiency
// 2. Provides real-time feedback during play
// 3. Adapts puzzle generation to target weak areas
// 4. Stores session data for long-term improvement tracking
// 5. Delivers detailed post-game analysis with specific recommendations

// ============================================================================
// PATTERN TAXONOMY - The logical techniques used in Queens puzzles
// ============================================================================

const PatternType = {
  // Basic patterns (cost 1)
  HIDDEN_SINGLE_ROW: 'HIDDEN_SINGLE_ROW',
  HIDDEN_SINGLE_COL: 'HIDDEN_SINGLE_COL', 
  HIDDEN_SINGLE_REGION: 'HIDDEN_SINGLE_REGION',
  
  // Intermediate patterns (cost 2)
  POINTING_ROW: 'POINTING_ROW',      // Region candidates all in one row
  POINTING_COL: 'POINTING_COL',      // Region candidates all in one col
  CLAIMING_ROW: 'CLAIMING_ROW',      // Row candidates all in one region
  CLAIMING_COL: 'CLAIMING_COL',      // Col candidates all in one region
  
  // Advanced patterns (cost 3-4)
  NISHIO_SIMPLE: 'NISHIO_SIMPLE',    // Single-step contradiction
  NISHIO_CHAIN: 'NISHIO_CHAIN',      // Multi-step contradiction chain
  
  // Expert patterns (cost 5+)
  FORCING_CHAIN: 'FORCING_CHAIN',    // If X then Y, if not X then Y
  ADJACENCY_TRAP: 'ADJACENCY_TRAP',  // Using no-touch rule strategically
};

const PatternInfo = {
  [PatternType.HIDDEN_SINGLE_ROW]: {
    name: 'Hidden Single (Row)',
    description: 'Only one cell in a row can contain a queen',
    difficulty: 1,
    tips: [
      'Scan each row for cells that are the only valid option',
      'Mark impossible cells with X to make singles obvious',
      'Check after each queen placement - new singles often appear'
    ]
  },
  [PatternType.HIDDEN_SINGLE_COL]: {
    name: 'Hidden Single (Column)',
    description: 'Only one cell in a column can contain a queen',
    difficulty: 1,
    tips: [
      'Scan each column top to bottom',
      'Column singles often appear after row placements',
      'Look for columns with many X marks'
    ]
  },
  [PatternType.HIDDEN_SINGLE_REGION]: {
    name: 'Hidden Single (Region)',
    description: 'Only one cell in a region can contain a queen',
    difficulty: 1,
    tips: [
      'Each colored region needs exactly one queen',
      'Small regions often have singles early',
      'Region singles are often the key breakthrough'
    ]
  },
  [PatternType.POINTING_ROW]: {
    name: 'Pointing Pair (Row)',
    description: 'All region candidates lie in one row, eliminating others in that row',
    difficulty: 2,
    tips: [
      'If a region\'s only options are in one row, no other queens can be in that row',
      'Look for long thin regions that span a single row',
      'This often unlocks hidden singles in other regions'
    ]
  },
  [PatternType.POINTING_COL]: {
    name: 'Pointing Pair (Column)',
    description: 'All region candidates lie in one column, eliminating others in that column',
    difficulty: 2,
    tips: [
      'Same as pointing row but vertical',
      'Vertical regions are prime candidates',
      'Combine with row analysis for breakthroughs'
    ]
  },
  [PatternType.CLAIMING_ROW]: {
    name: 'Claiming (Row)',
    description: 'All row candidates lie in one region, eliminating others in that region',
    difficulty: 2,
    tips: [
      'If a row\'s only options are in one region, mark other region cells',
      'Inverse of pointing - row claims a region',
      'Often appears in the endgame'
    ]
  },
  [PatternType.CLAIMING_COL]: {
    name: 'Claiming (Column)',
    description: 'All column candidates lie in one region, eliminating others in that region',
    difficulty: 2,
    tips: [
      'Vertical version of claiming',
      'Check columns with few remaining candidates',
      'Can cascade into multiple eliminations'
    ]
  },
  [PatternType.NISHIO_SIMPLE]: {
    name: 'Simple Contradiction',
    description: 'Placing a queen immediately leads to an impossible state',
    difficulty: 3,
    tips: [
      'Try placing a queen mentally and see if it breaks rules immediately',
      'Look for cells that would eliminate all options in a row/col/region',
      'The no-touch rule often creates these'
    ]
  },
  [PatternType.NISHIO_CHAIN]: {
    name: 'Contradiction Chain',
    description: 'Placing a queen leads to a sequence of forced moves that eventually contradict',
    difficulty: 4,
    tips: [
      'When stuck, try assuming a queen and follow the chain',
      'If you hit a contradiction, that cell must be X',
      'Keep the chain short - 2-3 steps is usually enough'
    ]
  },
  [PatternType.FORCING_CHAIN]: {
    name: 'Forcing Chain',
    description: 'Both possibilities for a cell lead to the same conclusion',
    difficulty: 5,
    tips: [
      'Advanced technique for very hard puzzles',
      'If queen OR no-queen both force the same result, that result is certain',
      'Usually not needed for standard puzzles'
    ]
  },
  [PatternType.ADJACENCY_TRAP]: {
    name: 'Adjacency Trap',
    description: 'Using the no-touch rule to eliminate candidates strategically',
    difficulty: 3,
    tips: [
      'Queens cannot touch - even diagonally',
      'A queen eliminates all 8 surrounding cells',
      'Corner and edge queens have more impact'
    ]
  }
};

// ============================================================================
// MOVE CLASSIFIER - Analyzes each move and identifies patterns used
// ============================================================================

class MoveClassifier {
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.size = puzzle.size;
    this.regions = puzzle.regions;
  }

  /**
   * Classify a queen placement - what pattern did it use?
   * @param {Object} board - Current board state before the move (2D array: 0=unknown, 1=queen, -1=X)
   * @param {number} row - Row of placement
   * @param {number} col - Column of placement
   * @returns {Object} Classification result
   */
  classifyQueenPlacement(board, row, col) {
    const candidates = this.getCandidatesInfo(board);
    const regionId = this.regions[row][col];

    // Check if it was a hidden single
    const rowCandidates = candidates.rows[row];
    const colCandidates = candidates.cols[col];
    const regionCandidates = candidates.regions[regionId];

    let pattern = null;
    let isOptimal = false;
    let alternativesCount = 0;

    // Hidden single detection
    if (rowCandidates.length === 1) {
      pattern = PatternType.HIDDEN_SINGLE_ROW;
      isOptimal = true;
    } else if (colCandidates.length === 1) {
      pattern = PatternType.HIDDEN_SINGLE_COL;
      isOptimal = true;
    } else if (regionCandidates.length === 1) {
      pattern = PatternType.HIDDEN_SINGLE_REGION;
      isOptimal = true;
    } else {
      // Check if there was a simpler move available
      const simplestAvailable = this.findSimplestPattern(board);
      if (simplestAvailable) {
        pattern = simplestAvailable.pattern;
        isOptimal = (simplestAvailable.row === row && simplestAvailable.col === col);
        alternativesCount = this.countAlternatives(board, row, col);
      } else {
        // Advanced pattern or guess
        pattern = this.detectAdvancedPattern(board, row, col);
        isOptimal = pattern !== null;
      }
    }

    return {
      row,
      col,
      pattern,
      isOptimal,
      alternativesCount,
      wasGuess: pattern === null,
      difficulty: pattern ? PatternInfo[pattern]?.difficulty || 1 : 0
    };
  }

  /**
   * Find the simplest available pattern on the board
   */
  findSimplestPattern(board) {
    const candidates = this.getCandidatesInfo(board);

    // Check for hidden singles (easiest)
    for (let r = 0; r < this.size; r++) {
      if (candidates.rows[r].length === 1 && !this.hasQueenInRow(board, r)) {
        const cell = candidates.rows[r][0];
        return { pattern: PatternType.HIDDEN_SINGLE_ROW, row: cell.r, col: cell.c };
      }
    }

    for (let c = 0; c < this.size; c++) {
      if (candidates.cols[c].length === 1 && !this.hasQueenInCol(board, c)) {
        const cell = candidates.cols[c][0];
        return { pattern: PatternType.HIDDEN_SINGLE_COL, row: cell.r, col: cell.c };
      }
    }

    for (let rid = 0; rid < this.size; rid++) {
      if (candidates.regions[rid].length === 1 && !this.hasQueenInRegion(board, rid)) {
        const cell = candidates.regions[rid][0];
        return { pattern: PatternType.HIDDEN_SINGLE_REGION, row: cell.r, col: cell.c };
      }
    }

    // Check for pointing patterns
    const pointing = this.findPointingPattern(board, candidates);
    if (pointing) return pointing;

    return null;
  }

  findPointingPattern(board, candidates) {
    for (let rid = 0; rid < this.size; rid++) {
      const cells = candidates.regions[rid];
      if (cells.length === 0 || cells.length > this.size) continue;

      const rows = new Set(cells.map(c => c.r));
      const cols = new Set(cells.map(c => c.c));

      if (rows.size === 1) {
        // All in one row - this is a pointing pattern
        return { pattern: PatternType.POINTING_ROW, info: { regionId: rid, row: cells[0].r } };
      }
      if (cols.size === 1) {
        return { pattern: PatternType.POINTING_COL, info: { regionId: rid, col: cells[0].c } };
      }
    }
    return null;
  }

  detectAdvancedPattern(board, row, col) {
    // Try to detect if this was a Nishio elimination result
    const testBoard = board.map(r => [...r]);
    
    // Check all other candidates - if placing them leads to contradiction, this was Nishio
    const candidates = this.getCandidatesInfo(board);
    const regionId = this.regions[row][col];
    const regionCells = candidates.regions[regionId];

    for (const cell of regionCells) {
      if (cell.r === row && cell.c === col) continue;
      
      if (this.wouldCauseContradiction(board, cell.r, cell.c)) {
        return PatternType.NISHIO_SIMPLE;
      }
    }

    return null; // Could be a guess or very advanced pattern
  }

  wouldCauseContradiction(board, row, col) {
    const testBoard = board.map(r => [...r]);
    testBoard[row][col] = 1;

    // Apply basic eliminations
    this.applyEliminations(testBoard, row, col);

    // Check for empty rows/cols/regions
    const candidates = this.getCandidatesInfo(testBoard);

    for (let r = 0; r < this.size; r++) {
      if (!this.hasQueenInRow(testBoard, r) && candidates.rows[r].length === 0) {
        return true;
      }
    }
    for (let c = 0; c < this.size; c++) {
      if (!this.hasQueenInCol(testBoard, c) && candidates.cols[c].length === 0) {
        return true;
      }
    }
    for (let rid = 0; rid < this.size; rid++) {
      if (!this.hasQueenInRegion(testBoard, rid) && candidates.regions[rid].length === 0) {
        return true;
      }
    }

    return false;
  }

  applyEliminations(board, row, col) {
    const regionId = this.regions[row][col];

    // Row and column
    for (let c = 0; c < this.size; c++) {
      if (c !== col && board[row][c] === 0) board[row][c] = -1;
    }
    for (let r = 0; r < this.size; r++) {
      if (r !== row && board[r][col] === 0) board[r][col] = -1;
    }

    // Neighbors
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && board[nr][nc] === 0) {
          board[nr][nc] = -1;
        }
      }
    }

    // Region
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.regions[r][c] === regionId && !(r === row && c === col) && board[r][c] === 0) {
          board[r][c] = -1;
        }
      }
    }
  }

  getCandidatesInfo(board) {
    const rows = Array(this.size).fill(null).map(() => []);
    const cols = Array(this.size).fill(null).map(() => []);
    const regions = Array(this.size).fill(null).map(() => []);

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (board[r][c] === 0) {
          const cell = { r, c };
          rows[r].push(cell);
          cols[c].push(cell);
          regions[this.regions[r][c]].push(cell);
        }
      }
    }

    return { rows, cols, regions };
  }

  countAlternatives(board, row, col) {
    const regionId = this.regions[row][col];
    let count = 0;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (board[r][c] === 0 && !(r === row && c === col)) {
          count++;
        }
      }
    }

    return count;
  }

  hasQueenInRow(board, row) {
    return board[row].some(cell => cell === 1);
  }

  hasQueenInCol(board, col) {
    return board.some(row => row[col] === 1);
  }

  hasQueenInRegion(board, regionId) {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.regions[r][c] === regionId && board[r][c] === 1) {
          return true;
        }
      }
    }
    return false;
  }
}

// ============================================================================
// PATTERN PROFILER - Tracks per-pattern proficiency over time
// ============================================================================

class PatternProfiler {
  constructor() {
    this.storageKey = 'queens_pattern_proficiency';
    this.data = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load pattern proficiency:', e);
    }

    return this.createDefaultData();
  }

  createDefaultData() {
    const data = {
      version: 1,
      patterns: {},
      sessions: [],
      totalPuzzlesSolved: 0,
      totalTimePlayed: 0,
      streakDays: 0,
      lastPlayedDate: null
    };

    // Initialize all patterns
    for (const pattern of Object.values(PatternType)) {
      data.patterns[pattern] = {
        timesEncountered: 0,
        timesRecognized: 0,    // User found it when it was optimal
        timesMissed: 0,        // User missed it when it was available
        averageTimeMs: 0,
        totalTimeMs: 0,
        recentResults: []      // Last 20 encounters: { recognized: bool, timeMs: number }
      };
    }

    return data;
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save pattern proficiency:', e);
    }
  }

  /**
   * Record a pattern encounter
   * @param {string} pattern - Pattern type
   * @param {boolean} recognized - Did user recognize it?
   * @param {number} timeMs - Time taken
   */
  recordEncounter(pattern, recognized, timeMs) {
    if (!this.data.patterns[pattern]) {
      this.data.patterns[pattern] = {
        timesEncountered: 0,
        timesRecognized: 0,
        timesMissed: 0,
        averageTimeMs: 0,
        totalTimeMs: 0,
        recentResults: []
      };
    }

    const p = this.data.patterns[pattern];
    p.timesEncountered++;
    if (recognized) {
      p.timesRecognized++;
    } else {
      p.timesMissed++;
    }
    p.totalTimeMs += timeMs;
    p.averageTimeMs = p.totalTimeMs / p.timesEncountered;

    // Keep last 20 results
    p.recentResults.push({ recognized, timeMs, timestamp: Date.now() });
    if (p.recentResults.length > 20) {
      p.recentResults.shift();
    }

    this.save();
  }

  /**
   * Get proficiency score for a pattern (0-100)
   */
  getPatternProficiency(pattern) {
    const p = this.data.patterns[pattern];
    if (!p || p.timesEncountered === 0) return 50; // Neutral if no data

    // Recognition rate (60% weight)
    const recognitionRate = p.timesRecognized / p.timesEncountered;

    // Recent trend (20% weight) - how are last 10 attempts?
    const recent = p.recentResults.slice(-10);
    const recentRate = recent.length > 0
      ? recent.filter(r => r.recognized).length / recent.length
      : recognitionRate;

    // Speed factor (20% weight) - faster than expected?
    const expectedTimeMs = PatternInfo[pattern]?.difficulty * 3000 || 3000;
    const speedFactor = Math.min(1.5, expectedTimeMs / Math.max(p.averageTimeMs, 1000));

    const score = (recognitionRate * 0.6 + recentRate * 0.2 + (speedFactor / 1.5) * 0.2) * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Get weakest patterns (for targeted practice)
   */
  getWeakestPatterns(count = 3) {
    const patterns = Object.keys(this.data.patterns)
      .map(pattern => ({
        pattern,
        proficiency: this.getPatternProficiency(pattern),
        encountered: this.data.patterns[pattern].timesEncountered
      }))
      .filter(p => p.encountered >= 3) // Need some data
      .sort((a, b) => a.proficiency - b.proficiency);

    return patterns.slice(0, count);
  }

  /**
   * Get strongest patterns
   */
  getStrongestPatterns(count = 3) {
    const patterns = Object.keys(this.data.patterns)
      .map(pattern => ({
        pattern,
        proficiency: this.getPatternProficiency(pattern),
        encountered: this.data.patterns[pattern].timesEncountered
      }))
      .filter(p => p.encountered >= 3)
      .sort((a, b) => b.proficiency - a.proficiency);

    return patterns.slice(0, count);
  }

  /**
   * Get overall skill level
   */
  getOverallSkillLevel() {
    const patterns = Object.keys(this.data.patterns);
    let totalWeight = 0;
    let weightedSum = 0;

    for (const pattern of patterns) {
      const p = this.data.patterns[pattern];
      const weight = Math.min(p.timesEncountered, 20); // Cap weight
      const proficiency = this.getPatternProficiency(pattern);
      weightedSum += proficiency * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  }

  /**
   * Record a completed session
   */
  recordSession(sessionData) {
    this.data.sessions.push({
      ...sessionData,
      timestamp: Date.now()
    });

    // Keep last 100 sessions
    if (this.data.sessions.length > 100) {
      this.data.sessions = this.data.sessions.slice(-100);
    }

    this.data.totalPuzzlesSolved++;
    this.data.totalTimePlayed += sessionData.timeMs || 0;

    // Update streak
    const today = new Date().toDateString();
    const lastPlayed = this.data.lastPlayedDate;
    if (lastPlayed !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastPlayed === yesterday) {
        this.data.streakDays++;
      } else if (lastPlayed !== today) {
        this.data.streakDays = 1;
      }
      this.data.lastPlayedDate = today;
    }

    this.save();
  }

  /**
   * Get improvement trend (comparing recent to older performance)
   */
  getImprovementTrend() {
    const sessions = this.data.sessions;
    if (sessions.length < 10) return { trend: 'neutral', change: 0 };

    const recent = sessions.slice(-10);
    const older = sessions.slice(-20, -10);

    if (older.length < 5) return { trend: 'neutral', change: 0 };

    const recentAvg = recent.reduce((sum, s) => sum + (s.score || 50), 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + (s.score || 50), 0) / older.length;

    const change = recentAvg - olderAvg;

    return {
      trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
      change: Math.round(change)
    };
  }

  getStats() {
    return {
      totalPuzzlesSolved: this.data.totalPuzzlesSolved,
      totalTimePlayed: this.data.totalTimePlayed,
      streakDays: this.data.streakDays,
      overallSkill: this.getOverallSkillLevel(),
      improvementTrend: this.getImprovementTrend(),
      weakestPatterns: this.getWeakestPatterns(),
      strongestPatterns: this.getStrongestPatterns()
    };
  }

  reset() {
    this.data = this.createDefaultData();
    this.save();
  }
}

// ============================================================================
// REAL-TIME COACH - Provides feedback during gameplay
// ============================================================================

class RealTimeCoach {
  constructor(puzzle, profiler) {
    this.puzzle = puzzle;
    this.profiler = profiler;
    this.classifier = new MoveClassifier(puzzle);
    this.moveHistory = [];
    this.boardHistory = [];
    this.currentBoard = Array(puzzle.size).fill(null).map(() => Array(puzzle.size).fill(0));
    this.feedbackQueue = [];
    this.lastMoveTime = Date.now();
    this.moveStartTime = Date.now();
    
    // For tracking what patterns were available
    this.availablePatternsAtMove = [];
  }

  /**
   * Called when user makes a move
   * Returns feedback object for UI
   */
  onMove(row, col, newState, oldState) {
    const now = Date.now();
    const thinkTime = now - this.moveStartTime;

    // Save board state before move
    const boardBefore = this.currentBoard.map(r => [...r]);

    // Update current board
    if (newState === CellState.QUEEN) {
      this.currentBoard[row][col] = 1;
    } else if (newState === CellState.MARKER) {
      this.currentBoard[row][col] = -1;
    } else {
      this.currentBoard[row][col] = 0;
    }

    // Classify the move
    let feedback = null;
    if (newState === CellState.QUEEN) {
      const classification = this.classifier.classifyQueenPlacement(boardBefore, row, col);
      
      // Record pattern encounter
      if (classification.pattern) {
        const recognized = classification.isOptimal;
        this.profiler.recordEncounter(classification.pattern, recognized, thinkTime);
      }

      // Find what simpler pattern was available (if any)
      const simpler = this.classifier.findSimplestPattern(boardBefore);

      feedback = this.generateQueenFeedback(classification, simpler, thinkTime);

      // Apply eliminations to board
      this.applyEliminationsToBoard(row, col);
    } else if (newState === CellState.MARKER) {
      feedback = this.generateMarkerFeedback(row, col, boardBefore);
    }

    // Record move
    this.moveHistory.push({
      row, col, newState, oldState, thinkTime, timestamp: now, feedback
    });
    this.boardHistory.push(boardBefore);

    // Reset move timer
    this.moveStartTime = now;

    return feedback;
  }

  applyEliminationsToBoard(row, col) {
    const regionId = this.puzzle.regions[row][col];

    // Row and column
    for (let c = 0; c < this.puzzle.size; c++) {
      if (c !== col && this.currentBoard[row][c] === 0) this.currentBoard[row][c] = -1;
    }
    for (let r = 0; r < this.puzzle.size; r++) {
      if (r !== row && this.currentBoard[r][col] === 0) this.currentBoard[r][col] = -1;
    }

    // Neighbors
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < this.puzzle.size && nc >= 0 && nc < this.puzzle.size) {
          if (this.currentBoard[nr][nc] === 0) this.currentBoard[nr][nc] = -1;
        }
      }
    }

    // Region
    for (let r = 0; r < this.puzzle.size; r++) {
      for (let c = 0; c < this.puzzle.size; c++) {
        if (this.puzzle.regions[r][c] === regionId && !(r === row && c === col)) {
          if (this.currentBoard[r][c] === 0) this.currentBoard[r][c] = -1;
        }
      }
    }
  }

  generateQueenFeedback(classification, simplerAvailable, thinkTime) {
    const feedback = {
      type: 'queen_placement',
      quality: 'neutral',
      message: '',
      details: '',
      pattern: classification.pattern,
      isOptimal: classification.isOptimal,
      thinkTime,
      tips: []
    };

    if (classification.wasGuess) {
      feedback.quality = 'warning';
      feedback.message = '🎲 That looks like a guess';
      feedback.details = 'No clear pattern detected. Try to find logical certainty.';
      if (simplerAvailable) {
        feedback.tips.push(`There was a ${PatternInfo[simplerAvailable.pattern]?.name || 'simpler'} move available`);
      }
    } else if (classification.isOptimal) {
      const patternInfo = PatternInfo[classification.pattern];
      if (thinkTime < 3000 && classification.difficulty <= 2) {
        feedback.quality = 'excellent';
        feedback.message = '⚡ Lightning fast!';
        feedback.details = `Perfect ${patternInfo?.name || 'pattern'} recognition`;
      } else if (thinkTime < 8000) {
        feedback.quality = 'good';
        feedback.message = '✓ Good move';
        feedback.details = patternInfo?.name || 'Correct pattern';
      } else {
        feedback.quality = 'ok';
        feedback.message = '✓ Correct';
        feedback.details = `${patternInfo?.name || 'Pattern'} found, but took a while`;
        feedback.tips.push('Try to spot this pattern faster next time');
      }
    } else {
      feedback.quality = 'suboptimal';
      feedback.message = '↪ Valid, but not optimal';
      if (simplerAvailable) {
        const simplerInfo = PatternInfo[simplerAvailable.pattern];
        feedback.details = `A ${simplerInfo?.name || 'simpler'} was available`;
        feedback.tips = simplerInfo?.tips?.slice(0, 2) || [];
      }
    }

    return feedback;
  }

  generateMarkerFeedback(row, col, boardBefore) {
    // Check if this was a necessary mark
    const wasCandidate = boardBefore[row][col] === 0;

    if (!wasCandidate) {
      return {
        type: 'marker',
        quality: 'redundant',
        message: 'Already marked',
        details: 'This cell was already eliminated'
      };
    }

    // Check if marking is correct (cell cannot have a queen)
    const solution = this.puzzle.solution;
    if (solution[row][col] === 1) {
      return {
        type: 'marker',
        quality: 'incorrect',
        message: '⚠️ Incorrect mark',
        details: 'This cell should have a queen!'
      };
    }

    return {
      type: 'marker',
      quality: 'good',
      message: '✓ Good elimination',
      details: ''
    };
  }

  /**
   * Get a hint based on current board state
   */
  getCoachingHint() {
    const simpler = this.classifier.findSimplestPattern(this.currentBoard);

    if (simpler) {
      const info = PatternInfo[simpler.pattern];
      return {
        pattern: simpler.pattern,
        patternName: info?.name || 'Pattern',
        location: simpler.row !== undefined ? { row: simpler.row, col: simpler.col } : null,
        tips: info?.tips || [],
        difficulty: info?.difficulty || 1
      };
    }

    return {
      pattern: null,
      patternName: 'No simple pattern',
      tips: ['Try looking for pointing pairs', 'Consider using contradiction testing'],
      difficulty: 3
    };
  }

  /**
   * Get summary for end of puzzle
   */
  getSummary() {
    const queenMoves = this.moveHistory.filter(m => m.newState === CellState.QUEEN);
    const optimalMoves = queenMoves.filter(m => m.feedback?.isOptimal);
    const guesses = queenMoves.filter(m => m.feedback?.pattern === null);

    const patternBreakdown = {};
    for (const move of queenMoves) {
      const pattern = move.feedback?.pattern || 'GUESS';
      patternBreakdown[pattern] = (patternBreakdown[pattern] || 0) + 1;
    }

    const avgThinkTime = queenMoves.length > 0
      ? queenMoves.reduce((sum, m) => sum + m.thinkTime, 0) / queenMoves.length
      : 0;

    return {
      totalMoves: this.moveHistory.length,
      queenPlacements: queenMoves.length,
      optimalMoves: optimalMoves.length,
      suboptimalMoves: queenMoves.length - optimalMoves.length - guesses.length,
      guesses: guesses.length,
      patternBreakdown,
      averageThinkTimeMs: Math.round(avgThinkTime),
      moveHistory: this.moveHistory
    };
  }

  reset() {
    this.moveHistory = [];
    this.boardHistory = [];
    this.currentBoard = Array(this.puzzle.size).fill(null).map(() => 
      Array(this.puzzle.size).fill(0)
    );
    this.moveStartTime = Date.now();
  }
}

// ============================================================================
// ADAPTIVE PUZZLE GENERATOR - Creates puzzles targeting weak patterns
// ============================================================================

class AdaptivePuzzleGenerator {
  constructor(profiler) {
    this.profiler = profiler;
  }

  /**
   * Generate a puzzle that targets the user's weak patterns
   */
  generateTargetedPuzzle(baseDifficulty) {
    const weakPatterns = this.profiler.getWeakestPatterns(3);
    const size = baseDifficulty.size;

    // Try to generate puzzles that emphasize weak patterns
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      attempts++;

      // Generate a random puzzle
      const regionGen = new RegionGenerator(size);
      const regions = regionGen.generate();

      const solutionGen = new SolutionGenerator(size, regions);
      const result = solutionGen.generate();

      if (result.count !== 1) continue;

      // Analyze what patterns this puzzle requires
      const solver = new LogicalSolver(size, regions, solutionGen.firstSolution);
      const logicResult = solver.solveLogically();

      if (!logicResult.solved) continue;

      // Check if it emphasizes weak patterns
      const puzzlePatterns = this.analyzePuzzlePatterns(logicResult.steps);
      const weaknessScore = this.calculateWeaknessTargeting(puzzlePatterns, weakPatterns);

      // Accept puzzle if it targets weaknesses or after many attempts
      if (weaknessScore > 0.3 || attempts > 30) {
        return {
          puzzle: new QueensPuzzle(size, regions, solutionGen.firstSolution),
          targetedPatterns: puzzlePatterns,
          weaknessScore
        };
      }
    }

    // Fallback to standard generation
    return {
      puzzle: PuzzleGenerator.generate(baseDifficulty),
      targetedPatterns: {},
      weaknessScore: 0
    };
  }

  analyzePuzzlePatterns(steps) {
    const patterns = {};

    for (const step of steps) {
      let pattern = null;
      if (step.type === 'PLACE_QUEEN_ROW') pattern = PatternType.HIDDEN_SINGLE_ROW;
      else if (step.type === 'PLACE_QUEEN_COL') pattern = PatternType.HIDDEN_SINGLE_COL;
      else if (step.type === 'PLACE_QUEEN_REGION') pattern = PatternType.HIDDEN_SINGLE_REGION;
      else if (step.type === 'POINTING_ELIMINATION') pattern = PatternType.POINTING_ROW;
      else if (step.type === 'NISHIO_ELIMINATION') pattern = PatternType.NISHIO_SIMPLE;

      if (pattern) {
        patterns[pattern] = (patterns[pattern] || 0) + 1;
      }
    }

    return patterns;
  }

  calculateWeaknessTargeting(puzzlePatterns, weakPatterns) {
    if (weakPatterns.length === 0) return 0;

    let score = 0;
    for (const weak of weakPatterns) {
      if (puzzlePatterns[weak.pattern]) {
        score += puzzlePatterns[weak.pattern] * (100 - weak.proficiency) / 100;
      }
    }

    return score / weakPatterns.length;
  }
}

// ============================================================================
// POST-GAME ANALYSIS - Detailed breakdown and recommendations
// ============================================================================

class PostGameAnalyzer {
  constructor(puzzle, coachSummary, profiler) {
    this.puzzle = puzzle;
    this.summary = coachSummary;
    this.profiler = profiler;
  }

  generateFullAnalysis() {
    const analysis = {
      // Performance overview
      performance: this.analyzePerformance(),
      
      // Pattern usage breakdown
      patternUsage: this.analyzePatternUsage(),
      
      // Time analysis
      timing: this.analyzeTimimg(),
      
      // Specific recommendations
      recommendations: this.generateRecommendations(),
      
      // Move-by-move breakdown
      moveBreakdown: this.generateMoveBreakdown(),
      
      // Progress comparison
      progress: this.analyzeProgress()
    };

    return analysis;
  }

  analyzePerformance() {
    const s = this.summary;
    const optimalRate = s.queenPlacements > 0 
      ? (s.optimalMoves / s.queenPlacements) * 100 
      : 0;

    let grade, description;
    if (optimalRate >= 90 && s.guesses === 0) {
      grade = 'A+';
      description = 'Exceptional! You\'re playing like a champion.';
    } else if (optimalRate >= 80 && s.guesses <= 1) {
      grade = 'A';
      description = 'Excellent pattern recognition and execution.';
    } else if (optimalRate >= 70) {
      grade = 'B';
      description = 'Good performance with room for improvement.';
    } else if (optimalRate >= 50) {
      grade = 'C';
      description = 'Solid fundamentals, but missing some patterns.';
    } else {
      grade = 'D';
      description = 'Focus on learning the basic patterns.';
    }

    return {
      grade,
      description,
      optimalRate: Math.round(optimalRate),
      guessCount: s.guesses,
      totalMoves: s.totalMoves
    };
  }

  analyzePatternUsage() {
    const breakdown = this.summary.patternBreakdown;
    const usage = [];

    for (const [pattern, count] of Object.entries(breakdown)) {
      const info = PatternInfo[pattern];
      usage.push({
        pattern,
        name: info?.name || pattern,
        count,
        difficulty: info?.difficulty || 0,
        proficiency: this.profiler.getPatternProficiency(pattern)
      });
    }

    return usage.sort((a, b) => b.count - a.count);
  }

  analyzeTimimg() {
    const moves = this.summary.moveHistory.filter(m => m.newState === CellState.QUEEN);
    if (moves.length === 0) return null;

    const times = moves.map(m => m.thinkTime);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const fastest = Math.min(...times);
    const slowest = Math.max(...times);

    // Find slow moves
    const slowMoves = moves
      .filter(m => m.thinkTime > avg * 1.5)
      .map(m => ({
        row: m.row,
        col: m.col,
        time: m.thinkTime,
        pattern: m.feedback?.pattern
      }));

    return {
      averageMs: Math.round(avg),
      fastestMs: fastest,
      slowestMs: slowest,
      slowMoves
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const s = this.summary;
    const weakest = this.profiler.getWeakestPatterns(2);

    // Based on guesses
    if (s.guesses > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Eliminate Guessing',
        description: `You made ${s.guesses} guess(es). Every queen should be placed with logical certainty.`,
        action: 'Before placing a queen, always verify it\'s the ONLY valid option for its row, column, or region.'
      });
    }

    // Based on weak patterns
    for (const weak of weakest) {
      const info = PatternInfo[weak.pattern];
      if (info && weak.proficiency < 60) {
        recommendations.push({
          priority: weak.proficiency < 40 ? 'high' : 'medium',
          title: `Practice: ${info.name}`,
          description: `Your proficiency is ${weak.proficiency}%. This is a key pattern.`,
          action: info.tips?.[0] || 'Focus on this pattern in your next puzzles.'
        });
      }
    }

    // Based on timing
    const timing = this.analyzeTimimg();
    if (timing && timing.averageMs > 10000) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Speed',
        description: 'Your average move time is over 10 seconds.',
        action: 'Practice pattern recognition drills. Speed comes from instant recognition.'
      });
    }

    // Based on suboptimal moves
    if (s.suboptimalMoves > s.optimalMoves) {
      recommendations.push({
        priority: 'high',
        title: 'Find Simpler Patterns First',
        description: 'You\'re often choosing complex solutions when simpler ones exist.',
        action: 'Always check for hidden singles in rows, columns, AND regions before trying anything else.'
      });
    }

    return recommendations;
  }

  generateMoveBreakdown() {
    return this.summary.moveHistory
      .filter(m => m.newState === CellState.QUEEN)
      .map((m, i) => ({
        moveNumber: i + 1,
        row: m.row,
        col: m.col,
        thinkTimeMs: m.thinkTime,
        pattern: m.feedback?.pattern,
        patternName: PatternInfo[m.feedback?.pattern]?.name || 'Unknown',
        quality: m.feedback?.quality || 'unknown',
        wasOptimal: m.feedback?.isOptimal || false,
        message: m.feedback?.message || ''
      }));
  }

  analyzeProgress() {
    const stats = this.profiler.getStats();
    const trend = stats.improvementTrend;

    return {
      totalPuzzles: stats.totalPuzzlesSolved,
      overallSkill: stats.overallSkill,
      trend: trend.trend,
      trendChange: trend.change,
      streakDays: stats.streakDays,
      strongestPattern: stats.strongestPatterns[0],
      weakestPattern: stats.weakestPatterns[0]
    };
  }
}

// ============================================================================
// GLOBAL COACHING INSTANCE
// ============================================================================

// Initialize global profiler (loaded from localStorage)
const globalProfiler = new PatternProfiler();
let globalCoach = null;

function initializeCoach(puzzle) {
  globalCoach = new RealTimeCoach(puzzle, globalProfiler);
  return globalCoach;
}

function getCoach() {
  return globalCoach;
}

function getProfiler() {
  return globalProfiler;
}

