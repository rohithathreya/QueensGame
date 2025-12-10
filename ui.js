// LinkedIn Queens - UI Layer
// Handles rendering, interactions, helpers, and visual feedback

// ============================================================================
// GLOBAL STATE
// ============================================================================

let currentGameState = null;
let currentDifficulty = Difficulty.MEDIUM;
let moveHistory = null;
let deductionEngine = null;
let autoHelper = null;

// Settings
let settings = {
    autoX: true,  // Auto-mark impossible cells when queen placed
    autoCheck: true,  // Auto-highlight violations
    showHint: false
};

let currentHint = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    startNewGame();
    updateTimer();
});

function setupEventListeners() {
    document.getElementById('difficulty-select').addEventListener('change', (e) => {
        const difficultyName = e.target.value;
        currentDifficulty = Difficulty[difficultyName.toUpperCase()];
    });

    document.getElementById('new-game-btn').addEventListener('click', startNewGame);
    document.getElementById('clear-btn').addEventListener('click', clearBoard);
    document.getElementById('undo-btn').addEventListener('click', undoMove);
    document.getElementById('hint-btn').addEventListener('click', showHint);

    // Settings toggles
    document.getElementById('auto-x-toggle').addEventListener('change', (e) => {
        settings.autoX = e.target.checked;
    });

    document.getElementById('auto-check-toggle').addEventListener('change', (e) => {
        settings.autoCheck = e.target.checked;
        refreshAllCells();  // Refresh to show/hide violations
    });

    document.getElementById('play-again-btn').addEventListener('click', () => {
        hideWinOverlay();
        startNewGame();
    });
}

// ============================================================================
// GAME CONTROL
// ============================================================================

function startNewGame() {
    // Generate new puzzle
    const puzzle = PuzzleGenerator.generate(currentDifficulty);
    currentGameState = new GameState(puzzle);
    moveHistory = new MoveHistory();
    deductionEngine = new DeductionEngine(currentGameState);
    autoHelper = new AutoHelper(currentGameState);
    currentHint = null;

    // Render
    renderBoard();
    updateStats();
    updateButtons();
}

function clearBoard() {
    if (!currentGameState) return;

    const size = currentGameState.puzzle.size;
    currentGameState.cellStates = Array(size).fill(null).map(() =>
        Array(size).fill(CellState.EMPTY)
    );
    moveHistory.clear();
    currentHint = null;

    renderBoard();
    updateStats();
    updateButtons();
}

function undoMove() {
    if (!moveHistory || !moveHistory.canUndo()) return;

    moveHistory.undo(currentGameState);
    currentHint = null;

    renderBoard();
    updateStats();
    updateButtons();
}

function showHint() {
    if (!deductionEngine) return;

    currentHint = deductionEngine.getHint();

    // Show hint message
    const hintMsg = document.getElementById('hint-message');
    hintMsg.textContent = currentHint.message;
    hintMsg.style.display = 'block';

    // Highlight hint cell if applicable
    if (currentHint.row !== undefined && currentHint.col !== undefined) {
        refreshAllCells();
    }

    // Hide hint message after 5 seconds
    setTimeout(() => {
        hintMsg.style.display = 'none';
        currentHint = null;
        refreshAllCells();
    }, 5000);
}

// ============================================================================
// BOARD RENDERING
// ============================================================================

function renderBoard() {
    const board = document.getElementById('game-board');
    const size = currentGameState.puzzle.size;

    // Clear existing board
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    // Create cells
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const cell = createCell(row, col);
            board.appendChild(cell);
        }
    }
}

function createCell(row, col) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.row = row;
    cell.dataset.col = col;
    cell.id = `cell-${row}-${col}`;

    // Set region color
    const regionId = currentGameState.puzzle.regions[row][col];
    const regionColor = REGION_COLORS[regionId % REGION_COLORS.length];
    cell.style.background = `linear-gradient(135deg, ${regionColor}88, ${regionColor}66)`;
    cell.style.borderColor = `${regionColor}AA`;

    // Add region border styling
    updateCellBorders(cell, row, col);

    // Set initial state
    updateCellVisual(cell, row, col);

    // Add click handler
    cell.addEventListener('click', () => handleCellClick(row, col));

    return cell;
}

function updateCellBorders(cell, row, col) {
    const size = currentGameState.puzzle.size;
    const regionId = currentGameState.puzzle.regions[row][col];

    // Check each side for region boundary
    const borders = {
        top: row === 0 || currentGameState.puzzle.regions[row - 1][col] !== regionId,
        right: col === size - 1 || currentGameState.puzzle.regions[row][col + 1] !== regionId,
        bottom: row === size - 1 || currentGameState.puzzle.regions[row + 1][col] !== regionId,
        left: col === 0 || currentGameState.puzzle.regions[row][col - 1] !== regionId
    };

    if (borders.top) cell.style.borderTopWidth = '2px';
    if (borders.right) cell.style.borderRightWidth = '2px';
    if (borders.bottom) cell.style.borderBottomWidth = '2px';
    if (borders.left) cell.style.borderLeftWidth = '2px';

    cell.style.borderStyle = 'solid';
}

function updateCellVisual(cell, row, col) {
    const state = currentGameState.getCellState(row, col);

    // Remove all state classes
    cell.classList.remove('empty', 'marker', 'queen', 'violation', 'hint');

    // Add current state class
    cell.classList.add(state.toLowerCase());

    // Check for violations (if auto-check enabled)
    if (settings.autoCheck && state === CellState.QUEEN) {
        const validator = new Validator(currentGameState);
        const violations = validator.getRuleViolations();

        if (isQueenInViolation(row, col, violations)) {
            cell.classList.add('violation');
        }
    }

    // Add hint highlighting
    if (currentHint && currentHint.row === row && currentHint.col === col) {
        cell.classList.add('hint');
    }
}

function isQueenInViolation(row, col, violations) {
    const regionId = currentGameState.puzzle.regions[row][col];

    // Check if in violated row, column, or region
    if (violations.rows.has(row)) return true;
    if (violations.cols.has(col)) return true;
    if (violations.regions.has(regionId)) return true;

    // Check if part of adjacent queen pair
    for (const [q1, q2] of violations.adjacentQueens) {
        if ((q1.row === row && q1.col === col) ||
            (q2.row === row && q2.col === col)) {
            return true;
        }
    }

    return false;
}

// ============================================================================
// INTERACTION HANDLING
// ============================================================================

function handleCellClick(row, col) {
    if (currentGameState.endTimeMillis) return; // Game over

    const oldState = currentGameState.getCellState(row, col);

    // Cycle cell state
    currentGameState.cycleCellState(row, col);

    const newState = currentGameState.getCellState(row, col);

    // Record move for undo
    moveHistory.recordMove(row, col, oldState, newState);

    // Apply auto-X if enabled and queen was placed
    if (settings.autoX && newState === CellState.QUEEN) {
        autoHelper.applyAutoX(row, col);
    }

    // Clear hint
    currentHint = null;
    const hintMsg = document.getElementById('hint-message');
    hintMsg.style.display = 'none';

    // Update all cells
    refreshAllCells();

    // Update stats and buttons
    updateStats();
    updateButtons();

    // Check for completion
    const validator = new Validator(currentGameState);
    if (validator.isComplete()) {
        handleWin();
    }
}

function refreshAllCells() {
    const size = currentGameState.puzzle.size;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const cell = document.getElementById(`cell-${row}-${col}`);
            if (cell) {
                updateCellVisual(cell, row, col);
            }
        }
    }
}

// ============================================================================
// STATS & UI UPDATES
// ============================================================================

function updateStats() {
    // Queen count
    const queenCount = currentGameState.getQueenCount();
    const totalQueens = currentGameState.puzzle.size;
    document.getElementById('queen-count').textContent = `${queenCount}/${totalQueens}`;
}

function updateButtons() {
    // Update undo button state
    const undoBtn = document.getElementById('undo-btn');
    undoBtn.disabled = !moveHistory || !moveHistory.canUndo();
}

function updateTimer() {
    if (currentGameState && !currentGameState.endTimeMillis) {
        const elapsed = currentGameState.getElapsedTime();
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        document.getElementById('timer').textContent =
            `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    requestAnimationFrame(updateTimer);
}

// ============================================================================
// WIN HANDLING
// ============================================================================

function handleWin() {
    currentGameState.endTimeMillis = Date.now();

    // Show win overlay
    showWinOverlay();

    // Trigger celebration animation
    celebrateBoard();
}

function showWinOverlay() {
    const overlay = document.getElementById('win-overlay');

    // Update stats
    const elapsed = currentGameState.getElapsedTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    document.getElementById('win-time').textContent =
        `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('win-difficulty').textContent =
        currentDifficulty.name;
    document.getElementById('win-size').textContent =
        `${currentGameState.puzzle.size}×${currentGameState.puzzle.size}`;

    overlay.classList.add('active');
}

function hideWinOverlay() {
    const overlay = document.getElementById('win-overlay');
    overlay.classList.remove('active');
}

function celebrateBoard() {
    const cells = document.querySelectorAll('.cell.queen');
    cells.forEach((cell, index) => {
        setTimeout(() => {
            cell.style.animation = 'none';
            setTimeout(() => {
                cell.style.animation = 'bounce 0.6s ease';
            }, 10);
        }, index * 100);
    });
}
