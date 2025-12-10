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
let generatorWorker = null;
let isGenerating = false;
let generatingOverlay = null;
let sharedPuzzleOverride = null;
let lastCompletionMillis = null;
let lastPreviewDataUrl = null;

// Settings
let settings = {
    autoX: false,  // permanently off per request
    autoCheck: true,  // permanently on per request
    showHint: false
};

let currentHint = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    ensureGeneratingOverlay();
    tryLoadSharedPuzzleFromUrl();
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

    document.getElementById('play-again-btn').addEventListener('click', () => {
        hideWinOverlay();
        startNewGame();
    });
}

// ============================================================================
// GAME CONTROL
// ============================================================================

async function startNewGame() {
    setGeneratingState(true);
    try {
        const puzzle = await (sharedPuzzleOverride
            ? Promise.resolve(sharedPuzzleOverride)
            : generatePuzzleAsync(currentDifficulty));
        sharedPuzzleOverride = null; // only consume once
        currentGameState = new GameState(puzzle);
        moveHistory = new MoveHistory();
        deductionEngine = new DeductionEngine(currentGameState);
        autoHelper = new AutoHelper(currentGameState);
        currentHint = null;

        renderBoard();
        updateStats();
        updateButtons();
    } catch (err) {
        console.error('Failed to generate puzzle', err);
        alert('Failed to generate puzzle. Please try again.');
    } finally {
        setGeneratingState(false);
    }
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

    if (borders.top) cell.style.borderTop = '3px solid white';
    if (borders.right) cell.style.borderRight = '3px solid white';
    if (borders.bottom) cell.style.borderBottom = '3px solid white';
    if (borders.left) cell.style.borderLeft = '3px solid white';

    // Ensure borders are visible on top of the base grid border
    cell.style.zIndex = (borders.top || borders.right || borders.bottom || borders.left) ? '1' : 'auto';
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

    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) newGameBtn.disabled = isGenerating;
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) hintBtn.disabled = isGenerating;
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
// ASYNC PUZZLE GENERATION (Web Worker fallback)
// ============================================================================

function setGeneratingState(flag) {
    isGenerating = flag;
    if (generatingOverlay) {
        generatingOverlay.classList.toggle('active', flag);
    }
    updateButtons();
}

function ensureWorker() {
    if (generatorWorker || typeof Worker === 'undefined') return generatorWorker;
    generatorWorker = new Worker('generatorWorker.js');
    return generatorWorker;
}

function ensureGeneratingOverlay() {
    if (generatingOverlay) return generatingOverlay;
    const board = document.getElementById('game-board');
    if (!board) return null;
    const overlay = document.createElement('div');
    overlay.id = 'generating-overlay';
    overlay.className = 'generating-overlay';
    overlay.innerHTML = '<div class="loading">Generating…</div>';
    board.parentElement.style.position = 'relative';
    board.parentElement.appendChild(overlay);
    generatingOverlay = overlay;
    return overlay;
}

function generatePuzzleAsync(difficulty) {
    return new Promise((resolve, reject) => {
        const worker = ensureWorker();
        if (!worker) {
            // Fallback to synchronous generation (will still block)
            try {
                const puzzle = PuzzleGenerator.generate(difficulty);
                return resolve(puzzle);
            } catch (err) {
                return reject(err);
            }
        }

        const handleMessage = (event) => {
            const data = event.data || {};
            if (data.status === 'ok') {
                const p = data.puzzle;
                resolve(new QueensPuzzle(p.size, p.regions, p.solution));
            } else {
                reject(new Error(data.message || 'Worker generation failed'));
            }
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
        };
        const handleError = (err) => {
            reject(err);
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
        };
        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);
        worker.postMessage({ difficulty });
    });
}

// ============================================================================
// SHARED PUZZLE LOAD/SAVE & CHALLENGE SHARE
// ============================================================================

function encodePuzzle(puzzle) {
    const payload = {
        s: puzzle.size,
        r: puzzle.regions,
        sol: puzzle.solution
    };
    const json = JSON.stringify(payload);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePuzzle(code) {
    const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(padded)));
    const data = JSON.parse(json);
    return new QueensPuzzle(data.s, data.r, data.sol);
}

function tryLoadSharedPuzzleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('p');
    if (!code) return;
    try {
        const puzzle = decodePuzzle(code);
        sharedPuzzleOverride = puzzle;
        // Adjust difficulty selector to match puzzle size
        const match = Object.values(Difficulty).find(d => d.size === puzzle.size);
        if (match) {
            currentDifficulty = match;
            const select = document.getElementById('difficulty-select');
            if (select) select.value = match.name.toLowerCase();
        }
    } catch (e) {
        console.error('Failed to load shared puzzle', e);
    }
}

function buildShareLink(elapsedMillis) {
    const code = encodePuzzle(currentGameState.puzzle);
    const seconds = Math.floor(elapsedMillis / 1000);
    const url = `${window.location.origin}${window.location.pathname}?p=${encodeURIComponent(code)}&t=${seconds}`;
    return url;
}

function updateChallengePreview() {
    const preview = document.getElementById('challenge-preview');
    const text = document.getElementById('challenge-text');
    if (!preview || !text || !currentGameState) return;

    const url = renderPuzzlePreview(currentGameState.puzzle);
    lastPreviewDataUrl = url;
    preview.src = url;
    const elapsed = lastCompletionMillis || currentGameState.getElapsedTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    text.textContent = `I solved this queens puzzle in ${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}. Can you beat me?`;
}

function renderPuzzlePreview(puzzle) {
    const size = puzzle.size;
    const cell = 16;
    const pad = 6;
    const canvas = document.createElement('canvas');
    canvas.width = size * cell + pad * 2;
    canvas.height = size * cell + pad * 2;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const regionId = puzzle.regions[r][c];
            const color = REGION_COLORS[regionId % REGION_COLORS.length];
            ctx.fillStyle = color;
            ctx.fillRect(pad + c * cell, pad + r * cell, cell - 1, cell - 1);
        }
    }
    return canvas.toDataURL('image/png');
}

async function getPreviewBlob() {
    if (!lastPreviewDataUrl) return null;
    const res = await fetch(lastPreviewDataUrl);
    return await res.blob();
}

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'challenge-btn') {
        handleChallengeShare();
    }
});

function handleChallengeShare() {
    if (!currentGameState || lastCompletionMillis == null) return;
    // Ensure preview exists
    if (!lastPreviewDataUrl) {
        updateChallengePreview();
    }

    const link = buildShareLink(lastCompletionMillis);
    const message = document.getElementById('challenge-text')?.textContent || 'I solved this queens puzzle. Can you beat me?';
    const baseShare = {
        title: 'Queens Puzzle Challenge',
        text: message,
        url: link
    };

    const tryShareWithImage = async () => {
        try {
            const blob = await getPreviewBlob();
            if (!blob) return false;
            const file = new File([blob], 'puzzle.png', { type: blob.type || 'image/png' });
            // Start with files + text/title (exclude url which can make canShare fail on some Chrome builds)
            const data = { title: baseShare.title, text: baseShare.text, files: [file] };
            if (navigator.canShare && navigator.canShare(data)) {
                await navigator.share(data);
                return true;
            }
            // Try including url if supported
            const dataWithUrl = { ...data, url: baseShare.url };
            if (navigator.canShare && navigator.canShare(dataWithUrl)) {
                await navigator.share(dataWithUrl);
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    };

    if (navigator.share) {
        tryShareWithImage().then((usedImage) => {
            if (usedImage) return;
            navigator.share(baseShare).catch(() => {
                copyToClipboard(link);
                openPreviewIfPossible();
            });
        });
    } else {
        copyToClipboard(link);
        openPreviewIfPossible();
        alert('Link copied! Send it to your friend.');
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
    } else {
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
    }
}

function openPreviewIfPossible() {
    if (!lastPreviewDataUrl) return;
    try {
        const w = window.open();
        if (w) {
            w.document.write(`<img src="${lastPreviewDataUrl}" style="width:100%;height:auto;filter:blur(6px);" />`);
        }
    } catch (_) { }
}
// ============================================================================
// WIN HANDLING
// ============================================================================

function handleWin() {
    currentGameState.endTimeMillis = Date.now();
    lastCompletionMillis = currentGameState.getElapsedTime();

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

    updateChallengePreview();

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
