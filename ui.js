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
let optimalPath = null;
let lastSkillAnalysis = null;
// Default OG worker base (can be overridden by window.WORKER_OG_BASE if needed)
const DEFAULT_OG_WORKER_BASE = 'https://queens-og.rohithmathreya.workers.dev';
const OG_WORKER_BASE = typeof window !== 'undefined'
    ? (window.WORKER_OG_BASE || DEFAULT_OG_WORKER_BASE)
    : DEFAULT_OG_WORKER_BASE;

// ============================================================================ 
// Bit-level encoding helpers for compact puzzle links 
// ============================================================================

function packBits(values, bitsPerValue) {
    const totalBits = values.length * bitsPerValue;
    const byteLen = Math.ceil(totalBits / 8);
    const out = new Uint8Array(byteLen);
    let bitPos = 0;
    for (const v of values) {
        for (let b = 0; b < bitsPerValue; b++) {
            if (v & (1 << b)) {
                const byteIndex = Math.floor(bitPos / 8);
                const bitIndex = bitPos % 8;
                out[byteIndex] |= (1 << bitIndex);
            }
            bitPos++;
        }
    }
    return out;
}

function unpackBits(buf, count, bitsPerValue, offsetBits = 0) {
    const res = [];
    let bitPos = offsetBits;
    for (let i = 0; i < count; i++) {
        let v = 0;
        for (let b = 0; b < bitsPerValue; b++) {
            const byteIndex = Math.floor(bitPos / 8);
            const bitIndex = bitPos % 8;
            if (buf[byteIndex] & (1 << bitIndex)) {
                v |= (1 << b);
            }
            bitPos++;
        }
        res.push(v);
    }
    return { values: res, nextBit: bitPos };
}

function toBase64Url(bytes) {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

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
        lastSkillAnalysis = null;

        // Compute optimal path in background (won't block UI)
        setTimeout(() => {
            try {
                const pathFinder = new OptimalPathFinder(puzzle);
                optimalPath = pathFinder.findOptimalPath();
                console.log(`Optimal path computed: ${optimalPath.queenPlacements.length} queen placements, cost ${optimalPath.totalCost}`);
            } catch (e) {
                console.warn('Failed to compute optimal path:', e);
                optimalPath = null;
            }
        }, 100);

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
    const size = puzzle.size;
    const cells = size * size;
    const flatRegions = [];
    const flatSolution = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            flatRegions.push(puzzle.regions[r][c]);
            flatSolution.push(puzzle.solution[r][c] ? 1 : 0);
        }
    }
    // regions need up to 3 bits (size <= 8), solutions 1 bit
    const regBuf = packBits(flatRegions, 3);
    const solBuf = packBits(flatSolution, 1);
    // header: [size (1 byte), regLen (2 bytes little endian), solLen (2 bytes little endian)]
    const header = new Uint8Array(5);
    header[0] = size;
    header[1] = regBuf.length & 0xff;
    header[2] = (regBuf.length >> 8) & 0xff;
    header[3] = solBuf.length & 0xff;
    header[4] = (solBuf.length >> 8) & 0xff;
    const all = new Uint8Array(header.length + regBuf.length + solBuf.length);
    all.set(header, 0);
    all.set(regBuf, header.length);
    all.set(solBuf, header.length + regBuf.length);
    return toBase64Url(all);
}

function decodePuzzle(code) {
    const bytes = fromBase64Url(code);
    const size = bytes[0];
    const regLen = bytes[1] | (bytes[2] << 8);
    const solLen = bytes[3] | (bytes[4] << 8);
    const regBuf = bytes.slice(5, 5 + regLen);
    const solBuf = bytes.slice(5 + regLen, 5 + regLen + solLen);
    const cells = size * size;
    const { values: flatRegions } = unpackBits(regBuf, cells, 3);
    const { values: flatSolution } = unpackBits(solBuf, cells, 1);
    const regions = [];
    const solution = [];
    for (let r = 0; r < size; r++) {
        regions.push([]);
        solution.push([]);
        for (let c = 0; c < size; c++) {
            const idx = r * size + c;
            regions[r][c] = flatRegions[idx];
            solution[r][c] = flatSolution[idx] ? 1 : 0;
        }
    }
    return new QueensPuzzle(size, regions, solution);
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
    if (OG_WORKER_BASE) {
        return `${OG_WORKER_BASE.replace(/\/+$/, '')}/share?p=${encodeURIComponent(code)}&t=${seconds}`;
    }
    return `${window.location.origin}${window.location.pathname}?p=${encodeURIComponent(code)}&t=${seconds}`;
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

    const link = buildShareLink(lastCompletionMillis);
    const message = document.getElementById('challenge-text')?.textContent || 'I solved this queens puzzle. Can you beat me?';
    const shareData = {
        title: 'Queens Puzzle Challenge',
        text: message,
        url: link
    };

    if (navigator.share) {
        navigator.share(shareData).catch(() => {
            copyToClipboard(link);
            alert('Link copied! Send it to your friend.');
        });
    } else {
        copyToClipboard(link);
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

    // Run skill analysis
    if (optimalPath && moveHistory) {
        try {
            const analyzer = new SkillAnalyzer(currentGameState.puzzle, optimalPath);
            lastSkillAnalysis = analyzer.analyze(moveHistory.getTimedMoves(), lastCompletionMillis);
            console.log('Skill analysis:', lastSkillAnalysis);
        } catch (e) {
            console.warn('Failed to analyze skill:', e);
            lastSkillAnalysis = null;
        }
    }

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

    // Update skill analysis display
    updateSkillAnalysisDisplay();

    updateChallengePreview();

    overlay.classList.add('active');
}

function updateSkillAnalysisDisplay() {
    const container = document.getElementById('skill-analysis');
    if (!container) return;

    if (!lastSkillAnalysis) {
        container.innerHTML = '<p class="analysis-pending">Analyzing...</p>';
        return;
    }

    const a = lastSkillAnalysis;
    const tier = a.tier;

    container.innerHTML = `
        <div class="skill-score-container">
            <div class="skill-score" style="color: ${tier.color}">
                <span class="score-value">${a.score}</span>
                <span class="score-label">SKILL SCORE</span>
            </div>
            <div class="skill-tier" style="background: ${tier.color}20; border-color: ${tier.color}">
                <span class="tier-emoji">${tier.emoji}</span>
                <span class="tier-name">${tier.name}</span>
            </div>
        </div>

        <div class="analysis-breakdown">
            <h4>Performance Breakdown</h4>
            <div class="breakdown-grid">
                <div class="breakdown-item">
                    <span class="breakdown-value">${a.efficiency}%</span>
                    <span class="breakdown-label">Efficiency</span>
                    <span class="breakdown-desc">vs optimal path</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-value">${a.orderSimilarity}%</span>
                    <span class="breakdown-label">Move Order</span>
                    <span class="breakdown-desc">similarity to optimal</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-value">${a.timeFactor}%</span>
                    <span class="breakdown-label">Speed</span>
                    <span class="breakdown-desc">vs expected time</span>
                </div>
            </div>
        </div>

        <div class="analysis-stats">
            <div class="stat-row">
                <span class="stat-label">Total Moves</span>
                <span class="stat-value">${a.totalMoves}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Queens Placed</span>
                <span class="stat-value">${a.queenPlacements}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Markers Used</span>
                <span class="stat-value">${a.markerPlacements}</span>
            </div>
            <div class="stat-row ${a.undoCount > 0 ? 'stat-penalty' : ''}">
                <span class="stat-label">Undos</span>
                <span class="stat-value">${a.undoCount}</span>
            </div>
            <div class="stat-row ${a.detourCount > 0 ? 'stat-penalty' : ''}">
                <span class="stat-label">Detours</span>
                <span class="stat-value">${a.detourCount}</span>
            </div>
        </div>

        <div class="optimal-comparison">
            <h4>vs Optimal Solution</h4>
            <div class="comparison-bar">
                <div class="bar-label">Your Cost</div>
                <div class="bar-container">
                    <div class="bar-fill bar-user" style="width: ${Math.min(100, (a.userEffectiveCost / Math.max(a.optimalCost, 1)) * 50)}%"></div>
                </div>
                <span class="bar-value">${a.userEffectiveCost}</span>
            </div>
            <div class="comparison-bar">
                <div class="bar-label">Optimal Cost</div>
                <div class="bar-container">
                    <div class="bar-fill bar-optimal" style="width: 50%"></div>
                </div>
                <span class="bar-value">${a.optimalCost}</span>
            </div>
        </div>
    `;
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
