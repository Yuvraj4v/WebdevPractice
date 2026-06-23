const ROWS = 6;
const COLS = 7;
const PLAYER_RED = 1;
const PLAYER_YELLOW = 2;

let board = [];
let currentPlayer = PLAYER_RED;
let gameOver = false;
let scores = { 1: 0, 2: 0 };
let isAI = false;
let aiThinking = false;
let winCells = [];

const boardEl = document.getElementById('board');
const turnText = document.getElementById('turnText');
const turnDot = document.getElementById('turnDot');
const messageEl = document.getElementById('message');
const redScoreEl = document.getElementById('redScoreDisplay');
const yellowScoreEl = document.getElementById('yellowScoreDisplay');
const restartBtn = document.getElementById('restartBtn');
const aiToggle = document.getElementById('aiToggle');
const themeToggle = document.getElementById('themeToggle');

let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playTone(freq, duration, type = 'sine', volume = 0.18) {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
}
function soundDrop() {
    playTone(300, 0.12, 'sine', 0.12);
    setTimeout(() => playTone(220, 0.10, 'sine', 0.10), 80);
}
function soundWin() {
    [523, 659, 784].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.2, 'sine', 0.15), i * 120);
    });
}
function soundDraw() {
    playTone(400, 0.25, 'square', 0.08);
    setTimeout(() => playTone(300, 0.25, 'square', 0.08), 200);
}

function createBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = `cell col-${c}`;
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.dataset.filled = 'false';
            boardEl.appendChild(cell);
        }
    }
    for (let c = 0; c < COLS; c++) {
        const colCells = boardEl.querySelectorAll(`.col-${c}`);
        colCells.forEach(el => {
            el.addEventListener('mouseenter', () => onColHover(c));
            el.addEventListener('mouseleave', () => onColHover(-1));
        });
    }
    boardEl.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        const col = parseInt(cell.dataset.col);
        if (!isNaN(col)) handleColumnClick(col);
    });
}

function renderBoard() {
    const cells = boardEl.querySelectorAll('.cell');
    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        const val = board[r][c];
        cell.className = `cell col-${c}`;
        cell.dataset.filled = 'false';
        if (val === PLAYER_RED) {
            cell.classList.add('red');
            cell.dataset.filled = 'true';
        } else if (val === PLAYER_YELLOW) {
            cell.classList.add('yellow');
            cell.dataset.filled = 'true';
        }
        if (winCells.some(w => w.row === r && w.col === c)) {
            cell.classList.add('win');
        }
        if (gameOver || isColumnFull(c)) {
            cell.classList.add('disabled');
        }
    });
    updateTurnDisplay();
    updateScoreDisplay();
}

let hoveredCol = -1;
function onColHover(col) {
    hoveredCol = col;
    for (let i = 0; i < COLS; i++) {
        boardEl.classList.remove(`col-hover-${i}`);
    }
    if (col >= 0 && !gameOver && !isColumnFull(col) && !aiThinking) {
        boardEl.classList.add(`col-hover-${col}`);
    }
}

function initGame() {
    board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    currentPlayer = PLAYER_RED;
    gameOver = false;
    winCells = [];
    aiThinking = false;
    messageEl.innerHTML = '&nbsp;';
    renderBoard();
    onColHover(-1);
    if (isAI && currentPlayer === PLAYER_YELLOW) {
        scheduleAI();
    }
}

function isColumnFull(col) {
    return board[0][col] !== 0;
}

function getLowestEmptyRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) return r;
    }
    return -1;
}

function dropPiece(col, isAIMove = false) {
    if (gameOver) return false;
    if (!isAIMove && aiThinking) return false;
    if (isColumnFull(col)) return false;

    const row = getLowestEmptyRow(col);
    if (row === -1) return false;

    board[row][col] = currentPlayer;
    soundDrop();
    renderBoard();

    const win = checkWin(row, col, currentPlayer);
    if (win) {
        winCells = win;
        gameOver = true;
        soundWin();
        renderBoard();
        const name = currentPlayer === PLAYER_RED ? 'Red' : 'Yellow';
        messageEl.innerHTML = `🏆 ${name} wins!`;
        scores[currentPlayer] = (scores[currentPlayer] || 0) + 1;
        updateScoreDisplay();
        updateTurnDisplay();
        return true;
    }

    if (isBoardFull()) {
        gameOver = true;
        soundDraw();
        messageEl.innerHTML = '🤝 Draw!';
        renderBoard();
        updateTurnDisplay();
        return true;
    }

    currentPlayer = (currentPlayer === PLAYER_RED) ? PLAYER_YELLOW : PLAYER_RED;
    renderBoard();
    updateTurnDisplay();

    if (isAI && !gameOver && currentPlayer === PLAYER_YELLOW) {
        scheduleAI();
    }
    return true;
}

function isBoardFull() {
    for (let c = 0; c < COLS; c++) {
        if (board[0][c] === 0) return false;
    }
    return true;
}

function checkWin(row, col, player) {
    const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1]
    ];

    for (const [dr, dc] of directions) {
        let cells = [{ row, col }];
        for (let i = 1; i < 4; i++) {
            const nr = row + dr * i, nc = col + dc * i;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
            if (board[nr][nc] !== player) break;
            cells.push({ row: nr, col: nc });
        }
        for (let i = 1; i < 4; i++) {
            const nr = row - dr * i, nc = col - dc * i;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
            if (board[nr][nc] !== player) break;
            cells.push({ row: nr, col: nc });
        }
        if (cells.length >= 4) return cells;
    }
    return null;
}

function updateTurnDisplay() {
    if (gameOver) {
        turnText.textContent = 'Game Over';
        turnDot.className = 'turn-dot';
        return;
    }
    const name = currentPlayer === PLAYER_RED ? "Red's turn" : "Yellow's turn";
    turnText.textContent = name;
    turnDot.className = `turn-dot ${currentPlayer === PLAYER_RED ? 'red-dot' : 'yellow-dot'}`;
}

function updateScoreDisplay() {
    redScoreEl.textContent = scores[PLAYER_RED] || 0;
    yellowScoreEl.textContent = scores[PLAYER_YELLOW] || 0;
}

function handleColumnClick(col) {
    if (gameOver) return;
    if (aiThinking) return;
    if (isAI && currentPlayer === PLAYER_YELLOW) return;
    dropPiece(col, false);
}

function scheduleAI() {
    if (aiThinking || gameOver) return;
    aiThinking = true;
    setTimeout(() => {
        if (gameOver || currentPlayer !== PLAYER_YELLOW) {
            aiThinking = false;
            return;
        }
        for (let c = 0; c < COLS; c++) {
            if (!isColumnFull(c)) {
                dropPiece(c, true);
                break;
            }
        }
        aiThinking = false;
    }, 300);
}

function restartGame() {
    if (aiThinking) return;
    initGame();
}

function toggleAI() {
    isAI = !isAI;
    aiToggle.textContent = isAI ? '🤖 AI On' : '🤖 AI Off';
    aiToggle.classList.toggle('active', isAI);
    if (isAI && !gameOver && currentPlayer === PLAYER_YELLOW) {
        scheduleAI();
    }
    if (!isAI) {
        aiThinking = false;
    }
}

function toggleTheme() {
    document.body.classList.toggle('light');
    themeToggle.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
}

createBoard();
initGame();

restartBtn.addEventListener('click', restartGame);
aiToggle.addEventListener('click', toggleAI);
themeToggle.addEventListener('click', toggleTheme);

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.body.classList.add('light');
    themeToggle.textContent = '☀️';
}