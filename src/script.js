// ─── Constants ───────────────────────────────────────────────────────────────

const ADJACENCY = [
  [1,3],        // 0
  [0,2,9],      // 1
  [1,4],        // 2
  [0,5,11],     // 3
  [2,7,12],     // 4
  [3,6],        // 5
  [5,7,14],     // 6
  [4,6],        // 7
  [9,11],       // 8
  [1,8,10,17],  // 9
  [9,12],       // 10
  [3,8,13,19],  // 11
  [4,10,15,20], // 12
  [11,14],      // 13
  [6,13,15,22], // 14
  [12,14],      // 15
  [17,19],      // 16
  [9,16,18],    // 17
  [17,20],      // 18
  [11,16,21],   // 19
  [12,18,23],   // 20
  [19,22],      // 21
  [14,21,23],   // 22
  [20,22],      // 23
];

const MILLS = [
  [0,1,2],[2,4,7],[7,6,5],[5,3,0],
  [8,9,10],[10,12,15],[15,14,13],[13,11,8],
  [16,17,18],[18,20,23],[23,22,21],[21,19,16],
  [1,9,17],[3,11,19],[4,12,20],[6,14,22],
];

// ─── Game Logic ───────────────────────────────────────────────────────────────

function initGame(mode, playerColor) {
  return {
    board: Array(24).fill(null),
    phase: 'placement',
    currentPlayer: 'black',
    piecesToPlace: { black: 9, white: 9 },
    piecesOnBoard: { black: 0, white: 0 },
    selectedNode: null,
    mustRemove: false,
    gameOver: null,
    boardHistory: [],
    mode,
    playerColor,
  };
}

function opponent(color) {
  return color === 'black' ? 'white' : 'black';
}

function getPhase(piecesToPlace, piecesOnBoard, player) {
  if (piecesToPlace[player] > 0) return 'placement';
  if (piecesOnBoard[player] === 3) return 'flying';
  return 'movement';
}

function recomputePhase(state) {
  state.phase = getPhase(state.piecesToPlace, state.piecesOnBoard, state.currentPlayer);
}

function getMills(board, color) {
  return MILLS.filter(([a, b, c]) => board[a] === color && board[b] === color && board[c] === color);
}

function isNewMill(boardBefore, boardAfter, color) {
  const before = new Set(getMills(boardBefore, color).map(m => m.join(',')));
  return getMills(boardAfter, color).some(m => !before.has(m.join(',')));
}

function getRemovablePieces(board, opp) {
  const inMill = new Set(getMills(board, opp).flat());
  const notInMill = [];
  const all = [];
  for (let i = 0; i < 24; i++) {
    if (board[i] === opp) {
      all.push(i);
      if (!inMill.has(i)) notInMill.push(i);
    }
  }
  return notInMill.length > 0 ? notInMill : all;
}

function getValidMoves(state) {
  const { board, phase, currentPlayer, mustRemove } = state;
  const opp = opponent(currentPlayer);

  if (mustRemove) {
    return getRemovablePieces(board, opp).map(n => ({ type: 'remove', node: n }));
  }

  if (phase === 'placement') {
    const moves = [];
    for (let i = 0; i < 24; i++) {
      if (board[i] === null) moves.push({ type: 'place', node: i });
    }
    return moves;
  }

  const moves = [];
  for (let from = 0; from < 24; from++) {
    if (board[from] !== currentPlayer) continue;
    if (phase === 'flying') {
      for (let to = 0; to < 24; to++) {
        if (board[to] === null) moves.push({ type: 'move', from, to });
      }
    } else {
      for (const to of ADJACENCY[from]) {
        if (board[to] === null) moves.push({ type: 'move', from, to });
      }
    }
  }
  return moves;
}

function applyPlacement(state, node) {
  const boardBefore = [...state.board];
  state.board[node] = state.currentPlayer;
  state.piecesToPlace[state.currentPlayer]--;
  state.piecesOnBoard[state.currentPlayer]++;

  if (isNewMill(boardBefore, state.board, state.currentPlayer)) {
    state.mustRemove = true;
  } else {
    switchPlayer(state);
  }
}

function applyMove(state, from, to) {
  const boardBefore = [...state.board];
  state.board[to] = state.currentPlayer;
  state.board[from] = null;
  state.selectedNode = null;

  if (isNewMill(boardBefore, state.board, state.currentPlayer)) {
    state.mustRemove = true;
  } else {
    switchPlayer(state);
  }
}

function applyRemoval(state, node) {
  state.board[node] = null;
  state.piecesOnBoard[opponent(state.currentPlayer)]--;
  state.mustRemove = false;
  checkWin(state);
  if (!state.gameOver) {
    switchPlayer(state);
  }
}

function hasLegalMoves(state, player) {
  const phase = getPhase(state.piecesToPlace, state.piecesOnBoard, player);
  if (phase === 'placement') return state.piecesToPlace[player] > 0;
  if (phase === 'flying') return state.piecesOnBoard[player] > 0;
  for (let i = 0; i < 24; i++) {
    if (state.board[i] !== player) continue;
    if (ADJACENCY[i].some(n => state.board[n] === null)) return true;
  }
  return false;
}

function checkWin(state) {
  const opp = opponent(state.currentPlayer);

  if (state.piecesOnBoard[opp] < 3 && state.piecesToPlace[opp] === 0) {
    state.gameOver = { winner: state.currentPlayer };
    return;
  }

  const oppPhase = getPhase(state.piecesToPlace, state.piecesOnBoard, opp);
  if (oppPhase === 'movement' && !hasLegalMoves(state, opp)) {
    state.gameOver = { winner: state.currentPlayer };
  }
}

function serializeBoard(state) {
  return state.board.join(',') + '|' + state.currentPlayer + '|' + state.phase;
}

function checkDraw(state) {
  const key = serializeBoard(state);
  state.boardHistory.push(key);
  const count = state.boardHistory.filter(k => k === key).length;
  if (count >= 3) {
    state.gameOver = { winner: 'draw' };
  }
}

function switchPlayer(state) {
  state.currentPlayer = opponent(state.currentPlayer);
  recomputePhase(state);
  checkWin(state);
  if (!state.gameOver) checkDraw(state);
}

function getAlmostMills(board, color) {
  let count = 0;
  for (const [a, b, c] of MILLS) {
    const pieces = [board[a], board[b], board[c]];
    const mine = pieces.filter(p => p === color).length;
    const empty = pieces.filter(p => p === null).length;
    if (mine === 2 && empty === 1) count++;
  }
  return count;
}

function evaluateBoard(state, computerColor) {
  if (state.gameOver) {
    if (state.gameOver.winner === computerColor) return 9999;
    if (state.gameOver.winner === opponent(computerColor)) return -9999;
    return 0;
  }

  const opp = opponent(computerColor);
  const board = state.board;

  let score = 0;
  score += getMills(board, computerColor).length * 200;
  score -= getMills(board, opp).length * 200;
  score += state.piecesOnBoard[computerColor] * 10;
  score -= state.piecesOnBoard[opp] * 10;
  score += getAlmostMills(board, computerColor) * 5;
  score -= getAlmostMills(board, opp) * 5;
  score += getMobility(state, computerColor);
  score -= getMobility(state, opp);
  return score;
}

function getMobility(state, player) {
  const phase = getPhase(state.piecesToPlace, state.piecesOnBoard, player);
  if (phase !== 'movement') return 0;
  let count = 0;
  for (let i = 0; i < 24; i++) {
    if (state.board[i] !== player) continue;
    count += ADJACENCY[i].filter(n => state.board[n] === null).length;
  }
  return count;
}

function cloneState(state) {
  return {
    board: [...state.board],
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    piecesToPlace: { ...state.piecesToPlace },
    piecesOnBoard: { ...state.piecesOnBoard },
    selectedNode: state.selectedNode,
    mustRemove: state.mustRemove,
    gameOver: state.gameOver ? { ...state.gameOver } : null,
    boardHistory: [...state.boardHistory],
    mode: state.mode,
    playerColor: state.playerColor,
  };
}

function applyAction(state, action) {
  if (action.type === 'place') applyPlacement(state, action.node);
  else if (action.type === 'move') applyMove(state, action.from, action.to);
  else if (action.type === 'remove') applyRemoval(state, action.node);
}

function orderMoves(state, moves, computerColor) {
  return moves.slice().sort((a, b) => {
    const scoreMove = (m) => {
      if (m.type === 'remove') return 10;
      const s = cloneState(state);
      applyAction(s, m);
      if (getMills(s.board, computerColor).length > getMills(state.board, computerColor).length) return 5;
      return 0;
    };
    return scoreMove(b) - scoreMove(a);
  });
}

function minimax(state, depth, alpha, beta, maximizing, computerColor) {
  if (depth === 0 || state.gameOver) {
    return evaluateBoard(state, computerColor);
  }

  const moves = getValidMoves(state);
  if (moves.length === 0) return evaluateBoard(state, computerColor);

  const ordered = orderMoves(state, moves, computerColor);

  if (maximizing) {
    let best = -Infinity;
    for (const move of ordered) {
      const next = cloneState(state);
      applyAction(next, move);
      const score = minimax(next, depth - 1, alpha, beta, next.currentPlayer === computerColor, computerColor);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of ordered) {
      const next = cloneState(state);
      applyAction(next, move);
      const score = minimax(next, depth - 1, alpha, beta, next.currentPlayer === computerColor, computerColor);
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

const STRATEGIC_NODES = new Set([1, 3, 4, 6, 9, 11, 12, 14]);

function getBestMove(state) {
  const computerColor = opponent(state.playerColor);
  const depth = 3;
  const moves = getValidMoves(state);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const next = cloneState(state);
    applyAction(next, move);
    let score = minimax(next, depth - 1, -Infinity, Infinity, next.currentPlayer === computerColor, computerColor);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function getBestRemoval(state) {
  const computerColor = opponent(state.playerColor);
  const opp = opponent(state.currentPlayer);
  const removable = getRemovablePieces(state.board, opp);

  let bestScore = -Infinity;
  let bestNode = removable[0];

  for (const node of removable) {
    const next = cloneState(state);
    next.board[node] = null;
    next.piecesOnBoard[opp]--;
    const score = evaluateBoard(next, computerColor);
    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return { type: 'remove', node: bestNode };
}

// ─── UI & Rendering ───────────────────────────────────────────────────────────

// Node positions in SVG space
const NODE_POS = [
  [40,40],[240,40],[440,40],
  [40,240],[440,240],
  [40,440],[240,440],[440,440],
  [120,120],[240,120],[360,120],
  [120,240],[360,240],
  [120,360],[240,360],[360,360],
  [200,200],[240,200],[280,200],
  [200,240],[280,240],
  [200,280],[240,280],[280,280],
];

// Board lines (pairs of node indices forming lines)
const LINES = [
  // outer square
  [0,1],[1,2],[2,4],[4,7],[7,6],[6,5],[5,3],[3,0],
  // middle square
  [8,9],[9,10],[10,12],[12,15],[15,14],[14,13],[13,11],[11,8],
  // inner square
  [16,17],[17,18],[18,20],[20,23],[23,22],[22,21],[21,19],[19,16],
  // cross connectors
  [1,9],[9,17],[3,11],[11,19],[4,12],[12,20],[6,14],[14,22],
];

const ICONS = {
  question: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M64 160c0-53 43-96 96-96s96 43 96 96c0 42.7-27.9 78.9-66.5 91.4-28.4 9.2-61.5 35.3-61.5 76.6l0 24c0 17.7 14.3 32 32 32s32-14.3 32-32l0-24c0-1.7 .6-4.1 3.5-7.3 3-3.3 7.9-6.5 13.7-8.4 64.3-20.7 110.8-81 110.8-152.3 0-88.4-71.6-160-160-160S0 71.6 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32zm96 352c22.1 0 40-17.9 40-40s-17.9-40-40-40-40 17.9-40 40 17.9 40 40 40z"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M376.6 84.5c11.3-13.6 9.5-33.8-4.1-45.1s-33.8-9.5-45.1 4.1L192 206 56.6 43.5C45.3 29.9 25.1 28.1 11.5 39.4S-3.9 70.9 7.4 84.5L150.3 256 7.4 427.5c-11.3 13.6-9.5 33.8 4.1 45.1s33.8 9.5 45.1-4.1L192 306 327.4 468.5c11.3 13.6 31.5 15.4 45.1 4.1s15.4-31.5 4.1-45.1L233.7 256 376.6 84.5z"/></svg>`,
  heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M241 87.1l15 20.7 15-20.7C296 52.5 336.2 32 378.9 32 452.4 32 512 91.6 512 165.1l0 2.6c0 112.2-139.9 242.5-212.9 298.2-12.4 9.4-27.6 14.1-43.1 14.1s-30.8-4.6-43.1-14.1C139.9 410.2 0 279.9 0 167.7l0-2.6C0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1z"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M288-32c8.4 0 16.3 4.4 20.6 11.7L364.1 72.3 468.9 46c8.2-2 16.9 .4 22.8 6.3S500 67 498 75.1l-26.3 104.7 92.7 55.5c7.2 4.3 11.7 12.2 11.7 20.6s-4.4 16.3-11.7 20.6L471.7 332.1 498 436.8c2 8.2-.4 16.9-6.3 22.8S477 468 468.9 466l-104.7-26.3-55.5 92.7c-4.3 7.2-12.2 11.7-20.6 11.7s-16.3-4.4-20.6-11.7L211.9 439.7 107.2 466c-8.2 2-16.8-.4-22.8-6.3S76 445 78 436.8l26.2-104.7-92.6-55.5C4.4 272.2 0 264.4 0 256s4.4-16.3 11.7-20.6L104.3 179.9 78 75.1c-2-8.2 .3-16.8 6.3-22.8S99 44 107.2 46l104.7 26.2 55.5-92.6 1.8-2.6c4.5-5.7 11.4-9.1 18.8-9.1zm0 144a144 144 0 1 0 0 288 144 144 0 1 0 0-288zm0 240a96 96 0 1 1 0-192 96 96 0 1 1 0 192z"/></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0C114.6 0 0 114.6 0 256S114.6 512 256 512c68.8 0 131.3-27.2 177.3-71.4 7.3-7 9.4-17.9 5.3-27.1s-13.7-14.9-23.8-14.1c-4.9 .4-9.8 .6-14.8 .6-101.6 0-184-82.4-184-184 0-72.1 41.5-134.6 102.1-164.8 9.1-4.5 14.3-14.3 13.1-24.4S322.6 8.5 312.7 6.3C294.4 2.2 275.4 0 256 0z"/></svg>`,
};

let gameState = null;
let thinkingTimeout = null;
let isThinking = false;
let isAnimating = false;
let shakeTimeout = null;

// Animation tracking
let animLastPlaced = null;   // node index of last placed piece
let animLastRemoved = null;  // node index of last removed piece
let animLastFrom = null;     // source node of last slide
let animLastTo = null;       // destination node of last slide
let animNewMillNodes = null; // Set of node indices in newly formed mills
let lastComputerTo = null;   // destination of last computer move

function getTheme() {
  return localStorage.getItem('nmm_theme') || 'dark';
}

function setTheme(t) {
  localStorage.setItem('nmm_theme', t);
  document.body.classList.toggle('light-palette', t === 'light');
}

function renderRecords() {
  const rec = getRecords();
  return `<div class="records"><span class="records-title">Wins</span><span class="records-value">${rec.pvc}</span></div>`;
}

function getRecords() {
  const raw = localStorage.getItem('nmm_records');
  return raw ? JSON.parse(raw) : { pvc: 0 };
}

function recordWin() {
  const rec = getRecords();
  rec.pvc++;
  localStorage.setItem('nmm_records', JSON.stringify(rec));
}

function saveGame(state) {
  localStorage.setItem('nmm_gameState', JSON.stringify(state));
}

function loadGame() {
  const raw = localStorage.getItem('nmm_gameState');
  return raw ? JSON.parse(raw) : null;
}

function clearSavedGame() {
  localStorage.removeItem('nmm_gameState');
}

function getLastPrefs() {
  return {
    mode: localStorage.getItem('nmm_mode') || 'pvc',
    playerColor: localStorage.getItem('nmm_playerColor') || 'black',
  };
}

function savePrefs(mode, playerColor) {
  localStorage.setItem('nmm_mode', mode);
  localStorage.setItem('nmm_playerColor', playerColor);
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function iconBtn(iconKey, label, classes = '') {
  return `<button class="icon-btn ${classes}" aria-label="${label}">${ICONS[iconKey]}</button>`;
}

function renderHeader(showClose = false, centerContent = '') {
  const theme = getTheme();
  const themeIcon = theme === 'dark' ? 'sun' : 'moon';
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return `<header class="game-header">
    <div class="header-left">
      ${showClose ? `<button class="icon-btn" id="btn-close" aria-label="Close game">${ICONS.x}</button>` : '<div class="icon-btn-placeholder"></div>'}
    </div>
    ${centerContent ? `<div class="header-center">${centerContent}</div>` : ''}
    <div class="header-right">
      <button class="icon-btn" id="btn-help" aria-label="Help">${ICONS.question}</button>
      <button class="icon-btn" id="btn-theme" aria-label="${themeLabel}" aria-pressed="${theme === 'light'}">${ICONS[themeIcon]}</button>
      <a href="https://www.freecodecamp.org/donate" target="_blank" rel="noopener" class="icon-btn" aria-label="Donate">${ICONS.heart}</a>
    </div>
  </header>`;
}

function renderHomeScreen() {
  const prefs = getLastPrefs();
  const saved = loadGame();

  return `<div class="screen home-screen">
    ${renderHeader(false)}
    <hr class="header-rule" />
    <div class="home-content">
      <h1 class="game-title">Nine Men's Morris</h1>
      <p class="game-subtitle">A classic strategy game for two</p>
      <div class="setup-group">
        <div class="pill-group" id="mode-group">
          <button class="pill ${prefs.mode === 'pvc' ? 'active' : ''}" data-value="pvc">vs Computer</button>
          <button class="pill ${prefs.mode === 'pvp' ? 'active' : ''}" data-value="pvp">2 Player</button>
        </div>
      </div>
      <div id="records-wrap" style="width:100%;${prefs.mode !== 'pvc' ? 'display:none' : ''}">${renderRecords()}</div>
      <div class="setup-group pvc-only" id="color-group-wrap" style="${prefs.mode !== 'pvc' ? 'display:none' : ''}">
        <div class="pill-group pill-group--sm" id="color-group">
          <button class="pill ${prefs.playerColor === 'black' ? 'active' : ''}" data-value="black">Go First</button>
          <button class="pill ${prefs.playerColor === 'white' ? 'active' : ''}" data-value="white">Go Second</button>
        </div>
      </div>
      <div class="home-actions">
        <button class="btn-primary" id="btn-new-game">New Game</button>
        ${saved ? `<button class="btn-secondary" id="btn-resume">Resume</button>` : ''}
      </div>
    </div>
  </div>`;
}

function getValidTargets(state) {
  const targets = new Set();
  if (!state || state.gameOver) return targets;
  const { phase, mustRemove, selectedNode, currentPlayer } = state;
  const opp = opponent(currentPlayer);

  if (mustRemove) {
    getRemovablePieces(state.board, opp).forEach(n => targets.add(n));
    return targets;
  }
  if (phase === 'placement') {
    for (let i = 0; i < 24; i++) {
      if (state.board[i] === null) targets.add(i);
    }
    return targets;
  }
  if (selectedNode !== null) {
    if (phase === 'flying') {
      for (let i = 0; i < 24; i++) {
        if (state.board[i] === null) targets.add(i);
      }
    } else {
      ADJACENCY[selectedNode].forEach(n => { if (state.board[n] === null) targets.add(n); });
    }
  }
  return targets;
}

function renderSVGBoard(state) {
  const board = state.board;
  const selectedNode = state.selectedNode;
  const mustRemove = state.mustRemove;
  const currentPlayer = state.currentPlayer;
  const opp = opponent(currentPlayer);
  const validTargets = getValidTargets(state);
  const millNodes = new Set(getMills(board, 'black').flat().concat(getMills(board, 'white').flat()));

  const linesSVG = LINES.map(([a, b]) => {
    const [x1, y1] = NODE_POS[a];
    const [x2, y2] = NODE_POS[b];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="board-line" />`;
  }).join('');

  const nodesSVG = NODE_POS.map(([cx, cy], i) => {
    const piece = board[i];
    const isSelected = i === selectedNode;
    const isTarget = validTargets.has(i);
    const isRemovable = mustRemove && board[i] === opp && validTargets.has(i);
    const isProtected = mustRemove && board[i] === opp && !validTargets.has(i);
    const inMill = millNodes.has(i) && piece !== null;
    const label = piece
      ? `Position ${i + 1}, ${piece === currentPlayer ? 'your piece' : "opponent's piece"}`
      : `Position ${i + 1}, empty`;

    let pieceCircle = '';
    let selectedRing = '';
    let lastMoveDot = '';
    if (piece) {
      const colorClass = piece === 'black' ? 'piece-blue' : 'piece-gold';
      const millClass = inMill ? ' piece-in-mill' : '';
      const protectedClass = isProtected ? ' piece-protected' : '';
      pieceCircle = `<circle cx="${cx}" cy="${cy}" r="13" class="piece ${colorClass}${millClass}${protectedClass}" />`;
      if (isSelected) selectedRing = `<circle cx="${cx}" cy="${cy}" r="17" class="piece-selected-ring piece-selected-ring--${piece === 'black' ? 'blue' : 'gold'}" />`;
      if (isRemovable) selectedRing = `<circle cx="${cx}" cy="${cy}" r="22" class="piece-removable-ring" />`;
      if (i === lastComputerTo) {
        lastMoveDot = `<circle cx="${cx}" cy="${cy}" r="4" class="last-move-dot" />`;
      }
    } else {
      pieceCircle = `<circle cx="${cx}" cy="${cy}" r="11" class="node-dot" />`;
    }

    let validDot = '';
    if (!piece && isTarget) {
      if (state.phase === 'movement') {
        const dotClass = currentPlayer === 'black' ? 'valid-dot valid-dot-blue' : 'valid-dot valid-dot-gold';
        validDot = `<circle cx="${cx}" cy="${cy}" r="6" class="${dotClass}" />`;
      } else if (state.phase === 'flying') {
        validDot = `<circle cx="${cx}" cy="${cy}" r="19" class="node-ring-target" />`;
      }
    }

    const tabindex = (isTarget || isSelected || (piece === currentPlayer && !mustRemove && state.phase !== 'placement')) ? '0' : '-1';

    return `<g class="board-node" data-node="${i}" role="button" tabindex="${tabindex}" aria-label="${label}">
      ${selectedRing}
      ${pieceCircle}
      ${validDot}
      ${lastMoveDot}
      <circle cx="${cx}" cy="${cy}" r="24" class="node-hit" />
    </g>`;
  }).join('');

  return `<svg class="board-svg" viewBox="0 0 480 480" role="img" aria-label="Nine Men's Morris board">
    <defs>
      <radialGradient id="grad-blue" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stop-color="var(--piece-blue)" />
        <stop offset="100%" stop-color="var(--piece-blue)" />
      </radialGradient>
      <radialGradient id="grad-gold" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stop-color="var(--piece-gold)" />
        <stop offset="100%" stop-color="var(--piece-gold)" />
      </radialGradient>
    </defs>
    ${linesSVG}
    ${nodesSVG}
  </svg>`;
}

function getStatusText(state) {
  if (state.gameOver) {
    const w = state.gameOver.winner;
    if (w === 'draw') return { text: 'Draw by repetition', cls: 'status-neutral' };
    const playerColor = state.playerColor;
    if (state.mode === 'pvc') {
      if (w === playerColor) return { text: 'You win!', cls: 'status-win' };
      return { text: 'Computer wins', cls: 'status-lose' };
    }
    const name = w === 'black' ? 'Blue' : 'Gold';
    return { text: `${name} wins!`, cls: 'status-win' };
  }

  if (isThinking) return { text: 'Computer is thinking...', cls: 'status-neutral' };

  const cp = state.currentPlayer;
  const cpName = state.mode === 'pvc'
    ? (cp === state.playerColor ? 'Your' : "Computer's")
    : (cp === 'black' ? "Player 1's" : "Player 2's");

  if (state.mustRemove) {
    return { text: `${cpName} turn: Remove an opponent piece`, cls: 'status-neutral' };
  }
  if (state.phase === 'placement') {
    return { text: `${cpName} turn: Place a piece`, cls: 'status-neutral' };
  }
  return { text: `${cpName} turn: Move a piece`, cls: 'status-neutral' };
}

function renderPiecesInHand(state) {
  if (state.phase !== 'placement') return '';
  const bCount = state.piecesToPlace.black;
  const wCount = state.piecesToPlace.white;
  return `<div class="pieces-in-hand" aria-label="Pieces remaining to place">
    <div class="hand-row">
      <span class="hand-label" aria-label="Blue pieces remaining: ${bCount}">Blue</span>
      <div class="hand-dots">${Array(bCount).fill('<span class="hand-dot blue"></span>').join('')}</div>
      <span class="hand-count mono">${bCount}</span>
    </div>
    <div class="hand-row">
      <span class="hand-label" aria-label="Gold pieces remaining: ${wCount}">Gold</span>
      <div class="hand-dots">${Array(wCount).fill('<span class="hand-dot gold"></span>').join('')}</div>
      <span class="hand-count mono">${wCount}</span>
    </div>
  </div>`;
}

function renderPlayScreen(state) {
  const status = getStatusText(state);
  return `<div class="screen play-screen">
    ${renderHeader(true, `<span class="status-text ${status.cls}" id="status-text" aria-live="polite">${status.text}</span>`)}
    <hr class="header-rule" />
    <div class="play-content">
      ${renderPiecesInHand(state)}
      <div class="board-wrap">
        ${renderSVGBoard(state)}
      </div>
      ${state.gameOver ? renderGameOverOverlay(state) : ''}
    </div>
  </div>`;
}

function renderGameOverOverlay(state) {
  const w = state.gameOver.winner;
  let resultText, resultCls;
  if (w === 'draw') {
    resultText = 'Draw';
    resultCls = 'status-neutral';
  } else if (state.mode === 'pvc') {
    if (w === state.playerColor) {
      resultText = 'You Win!';
      resultCls = 'status-win';
    } else {
      resultText = 'Computer Wins';
      resultCls = 'status-lose';
    }
  } else {
    resultText = `${w === 'black' ? 'Blue' : 'Gold'} Wins!`;
    resultCls = 'status-win';
  }
  const rec = getRecords();
  return `<div class="game-over-overlay" role="dialog" aria-modal="true" aria-label="Game over">
    <div class="game-over-panel">
      <div class="game-over-result ${resultCls}">${resultText}</div>
      <div class="game-over-actions">
        <button class="btn-primary" id="btn-play-again">Play Again</button>
        <button class="btn-secondary" id="btn-menu">Menu</button>
      </div>
    </div>
  </div>`;
}

function renderHelpModal() {
  return `<div class="modal-backdrop" id="help-modal" role="dialog" aria-modal="true" aria-label="Help">
    <div class="modal-panel">
      <div class="modal-header">
        <h2 class="modal-title">How to Play</h2>
        <button class="icon-btn" id="btn-help-close" aria-label="Close help">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <h3>Objective</h3>
        <p>Reduce your opponent to 2 pieces, or leave them with no legal moves.</p>
        <h3>Rules</h3>
        <ul>
          <li>Place all 9 pieces on the board, one per turn, on any empty intersection.</li>
          <li>Each time you get 3 in a row (a "mill"), remove one of your opponent's pieces - but not one in a mill unless that is all they have left.</li>
          <li>Once all pieces are placed, slide pieces one step at a time along the lines.</li>
          <li>If you are down to 3 pieces, you may "fly" - jump to any open spot.</li>
          <li>You lose if you are reduced to 2 pieces or have no legal moves.</li>
        </ul>
        <h3>Key Strategies</h3>
        <ul>
          <li><strong>Build mills early</strong> - corners and midpoints of the outer ring participate in more mills.</li>
          <li><strong>Double mill trap</strong> - set up two overlapping mills sharing one piece; slide it back and forth to remove a piece every turn.</li>
          <li><strong>Block before you build</strong> - if your opponent has 2 in a mill, block the third spot immediately.</li>
          <li><strong>Keep pieces mobile</strong> - spread pieces so you always have moves in the movement phase.</li>
          <li><strong>Force no-move situations</strong> - winning by blocking is just as valid as reducing them to 2 pieces.</li>
        </ul>
        <h3>Common Mistakes</h3>
        <ul>
          <li>Focusing only on placement without watching the opponent build a mill.</li>
          <li>Removing opponent pieces from far corners when you should target pieces in forming mills.</li>
          <li>Leaving a double mill setup uncontested - once established it is almost unbeatable.</li>
          <li>Moving into the movement phase with poor piece distribution and getting blocked immediately.</li>
          <li>Forgetting that flying players cannot be blocked, only eliminated by piece count.</li>
        </ul>
        <h3>Tips for Beginners</h3>
        <ul>
          <li>Focus on the outer and middle rings first - the inner square is cramped.</li>
          <li>Count how many mills each empty spot belongs to before you place.</li>
          <li>Removing from an active mill is allowed when that is all the opponent has.</li>
        </ul>
      </div>
    </div>
  </div>`;
}

function renderConfirmModal(message) {
  return `<div class="modal-backdrop" id="confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm action">
    <div class="modal-panel modal-panel-sm">
      <div class="modal-header">
        <h2 class="modal-title">Are you sure?</h2>
      </div>
      <div class="modal-body">
        <p>${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" id="btn-confirm-yes">Confirm</button>
        <button class="btn-secondary" id="btn-confirm-no">Cancel</button>
      </div>
    </div>
  </div>`;
}

// ─── App state & screen management ───────────────────────────────────────────

let currentScreen = 'home';

function render() {
  const app = document.getElementById('app');
  if (currentScreen === 'home') {
    app.innerHTML = renderHomeScreen();
    bindHomeEvents();
  } else {
    app.innerHTML = renderPlayScreen(gameState);
    bindPlayEvents();
  }
}

function showHelp() {
  document.body.insertAdjacentHTML('beforeend', renderHelpModal());
  const modal = document.getElementById('help-modal');
  trapFocus(modal);
  document.getElementById('btn-help-close').addEventListener('click', closeHelp);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeHelp(); });
}

function closeHelp() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.remove();
}

function showConfirm(message, onConfirm) {
  document.body.insertAdjacentHTML('beforeend', renderConfirmModal(message));
  const modal = document.getElementById('confirm-modal');
  trapFocus(modal);
  document.getElementById('btn-confirm-yes').addEventListener('click', () => {
    modal.remove();
    onConfirm();
  });
  document.getElementById('btn-confirm-no').addEventListener('click', () => {
    modal.remove();
  });
}

function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button, a, [tabindex="0"]');
  if (!focusable.length) return;
  focusable[0].focus();
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

function bindThemeAndHelp() {
  const btnTheme = document.getElementById('btn-theme');
  const btnHelp = document.getElementById('btn-help');
  if (btnTheme) btnTheme.addEventListener('click', () => {
    const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    render();
  });
  if (btnHelp) btnHelp.addEventListener('click', showHelp);
}

function bindHomeEvents() {
  bindThemeAndHelp();

  const prefs = getLastPrefs();
  let mode = prefs.mode;
  let playerColor = prefs.playerColor;

  function updatePvcVisibility() {
    const cWrap = document.getElementById('color-group-wrap');
    const rWrap = document.getElementById('records-wrap');
    if (cWrap) cWrap.style.display = mode === 'pvc' ? '' : 'none';
    if (rWrap) rWrap.style.display = mode === 'pvc' ? '' : 'none';
  }

  document.getElementById('mode-group').addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    mode = pill.dataset.value;
    document.querySelectorAll('#mode-group .pill').forEach(p => p.classList.toggle('active', p === pill));
    updatePvcVisibility();
  });

  document.getElementById('color-group').addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    playerColor = pill.dataset.value;
    document.querySelectorAll('#color-group .pill').forEach(p => p.classList.toggle('active', p === pill));
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    savePrefs(mode, playerColor);
    gameState = initGame(mode, playerColor);
    clearSavedGame();
    currentScreen = 'play';
    render();
    scheduleAiIfNeeded();
  });

  const btnResume = document.getElementById('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      const saved = loadGame();
      if (saved) {
        gameState = saved;
        currentScreen = 'play';
        render();
        scheduleAiIfNeeded();
      }
    });
  }
}

function bindPlayEvents() {
  bindThemeAndHelp();

  const btnClose = document.getElementById('btn-close');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (!gameState.gameOver) {
        showConfirm('Your progress will be saved.', () => {
          gameState = null;
          currentScreen = 'home';
          render();
        });
      } else {
        clearSavedGame();
        gameState = null;
        currentScreen = 'home';
        render();
      }
    });
  }

  const btnPlayAgain = document.getElementById('btn-play-again');
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      const { mode, playerColor } = gameState;
      gameState = initGame(mode, playerColor);
      clearSavedGame();
      render();
      scheduleAiIfNeeded();
    });
  }

  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      clearSavedGame();
      gameState = null;
      currentScreen = 'home';
      render();
    });
  }

  // Board node clicks
  document.querySelectorAll('.board-node').forEach(el => {
    el.addEventListener('click', () => onNodeClick(parseInt(el.dataset.node)));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNodeClick(parseInt(el.dataset.node));
      }
    });
  });
}

function isComputerTurn(state) {
  return state.mode === 'pvc' && state.currentPlayer !== state.playerColor;
}

function scheduleAiIfNeeded() {
  if (!gameState || gameState.gameOver || !isComputerTurn(gameState)) return;
  isThinking = true;
  updateStatusBar();
  thinkingTimeout = setTimeout(() => {
    doAiMove();
  }, 400);
}

function doAiMove() {
  isThinking = false;
  if (!gameState || gameState.gameOver) return;

  let action;
  if (gameState.mustRemove) {
    action = getBestRemoval(gameState);
  } else {
    action = getBestMove(gameState);
  }

  if (!action) return;

  if (action.type === 'remove') {
    animateRemovalThenApply(action.node);
    return;
  }

  if (action.type === 'move') {
    lastComputerTo = action.to;
    animateMoveThenApply(action.from, action.to);
    return;
  }

  // placement
  const boardBefore = [...gameState.board];
  const playerBefore = gameState.currentPlayer;
  const millsBefore = getMills(boardBefore, playerBefore).map(m => m.join(','));

  applyAction(gameState, action);

  animLastPlaced = action.node;
  const millsAfter = getMills(gameState.board, playerBefore).map(m => m.join(','));
  const newMills = millsAfter.filter(m => !millsBefore.includes(m));
  if (newMills.length > 0) {
    animNewMillNodes = new Set(newMills.flatMap(m => m.split(',').map(Number)));
  }

  finalizeAfterAction();
}

function animateRemovalThenApply(nodeIndex) {
  isAnimating = true;
  animLastRemoved = nodeIndex;
  renderBoardOnly();
  applyRemovalAnimation(nodeIndex);

  setTimeout(() => {
    isAnimating = false;
    animLastRemoved = null;
    applyRemoval(gameState, nodeIndex);
    finalizeAfterAction();
  }, 200);
}

function animateMoveThenApply(fromNode, toNode) {
  animLastFrom = fromNode;
  animLastTo = toNode;

  const boardBefore = [...gameState.board];
  const playerBefore = gameState.currentPlayer;
  const millsBefore = getMills(boardBefore, playerBefore).map(m => m.join(','));

  applyMove(gameState, fromNode, toNode);

  const millsAfter = getMills(gameState.board, playerBefore).map(m => m.join(','));
  const newMills = millsAfter.filter(m => !millsBefore.includes(m));
  if (newMills.length > 0) {
    animNewMillNodes = new Set(newMills.flatMap(m => m.split(',').map(Number)));
  }

  finalizeAfterAction();
}

function renderBoardOnly() {
  const boardWrap = document.querySelector('.board-wrap');
  if (!boardWrap) return;
  boardWrap.innerHTML = renderSVGBoard(gameState);
}

function applyRemovalAnimation(nodeIndex) {
  const el = document.querySelector(`.board-node[data-node="${nodeIndex}"] .piece`);
  if (!el) return;
  el.style.animationName = 'piece-disappear';
  el.style.animationDuration = '200ms';
  el.style.animationFillMode = 'forwards';
  el.style.animationTimingFunction = 'ease';
}

function finalizeAfterAction() {
  if (gameState.gameOver) {
    if (gameState.mode === 'pvc' && gameState.gameOver.winner === gameState.playerColor) {
      recordWin();
    }
    clearSavedGame();
  } else {
    saveGame(gameState);
  }

  render();
  applyPostRenderAnimations();

  animLastPlaced = null;
  animLastRemoved = null;
  animLastFrom = null;
  animLastTo = null;
  animNewMillNodes = null;

  if (!gameState.gameOver && isComputerTurn(gameState)) {
    scheduleAiIfNeeded();
  }
}

function applyPostRenderAnimations() {
  // Placement: scale in new piece
  if (animLastPlaced !== null) {
    const el = document.querySelector(`.board-node[data-node="${animLastPlaced}"] .piece`);
    if (el) {
      el.style.animation = 'piece-appear 200ms ease forwards';
    }
  }

  // Slide: translate from source position
  if (animLastFrom !== null && animLastTo !== null) {
    const el = document.querySelector(`.board-node[data-node="${animLastTo}"] .piece`);
    if (el) {
      const [fx, fy] = NODE_POS[animLastFrom];
      const [tx, ty] = NODE_POS[animLastTo];
      const dx = fx - tx;
      const dy = fy - ty;
      el.style.animation = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'transform 200ms ease';
      // Force reflow then animate to final position
      void el.getBoundingClientRect();
      el.style.transform = 'translate(0, 0)';
    }
  }

  // Mill flash: pulse newly formed mill pieces
  if (animNewMillNodes) {
    animNewMillNodes.forEach(nodeIndex => {
      const el = document.querySelector(`.board-node[data-node="${nodeIndex}"] .piece`);
      if (el) {
        el.classList.add('piece-mill-flash');
        el.addEventListener('animationend', () => el.classList.remove('piece-mill-flash'), { once: true });
      }
    });
  }
}

function updateStatusBar() {
  const el = document.getElementById('status-text');
  if (!el) return;
  const status = getStatusText(gameState);
  el.textContent = status.text;
  el.className = `status-text ${status.cls}`;
}

function shakeStatusBar() {
  const el = document.getElementById('status-text');
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  if (shakeTimeout) clearTimeout(shakeTimeout);
  shakeTimeout = setTimeout(() => el.classList.remove('shake'), 500);
}

function onNodeClick(nodeIndex) {
  if (!gameState || gameState.gameOver) return;
  if (isThinking || isAnimating) return;
  if (isComputerTurn(gameState)) return;

  const { board, selectedNode, mustRemove, phase } = gameState;
  const stateBefore = JSON.stringify({ board: gameState.board, selectedNode, mustRemove });

  // Detect if this click will be a removal
  if (mustRemove) {
    const opp = opponent(gameState.currentPlayer);
    const removable = getRemovablePieces(board, opp);
    if (removable.includes(nodeIndex)) {
      animateRemovalThenApply(nodeIndex);
      return;
    } else {
      shakeStatusBar();
      return;
    }
  }

  // Detect if this click will be a slide/fly move
  if ((phase === 'movement' || phase === 'flying') && selectedNode !== null && board[nodeIndex] === null) {
    const validDest = phase === 'flying' ? true : ADJACENCY[selectedNode].includes(nodeIndex);
    if (validDest) {
      animateMoveThenApply(selectedNode, nodeIndex);
      return;
    }
  }

  // Placement or selection change
  const boardBefore = [...gameState.board];
  const playerBefore = gameState.currentPlayer;
  const millsBefore = getMills(boardBefore, playerBefore).map(m => m.join(','));

  handleClick(gameState, nodeIndex);

  const stateAfter = JSON.stringify({ board: gameState.board, selectedNode: gameState.selectedNode, mustRemove: gameState.mustRemove });
  if (stateBefore === stateAfter && gameState.mustRemove) {
    shakeStatusBar();
    return;
  }

  // Track placement animation
  if (phase === 'placement' && gameState.board[nodeIndex] === playerBefore) {
    animLastPlaced = nodeIndex;
    const millsAfter = getMills(gameState.board, playerBefore).map(m => m.join(','));
    const newMills = millsAfter.filter(m => !millsBefore.includes(m));
    if (newMills.length > 0) {
      animNewMillNodes = new Set(newMills.flatMap(m => m.split(',').map(Number)));
    }
  }

  finalizeAfterAction();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

(function init() {
  setTheme(getTheme());
  render();
})();

function handleClick(state, nodeIndex) {
  const { board, phase, currentPlayer, mustRemove, selectedNode } = state;
  const opp = opponent(currentPlayer);

  if (mustRemove) {
    const removable = getRemovablePieces(board, opp);
    if (removable.includes(nodeIndex)) {
      applyRemoval(state, nodeIndex);
    }
    return;
  }

  if (phase === 'placement') {
    if (board[nodeIndex] === null) {
      applyPlacement(state, nodeIndex);
    }
    return;
  }

  if (selectedNode === null) {
    if (board[nodeIndex] === currentPlayer) {
      state.selectedNode = nodeIndex;
    }
    return;
  }

  if (nodeIndex === selectedNode) {
    state.selectedNode = null;
    return;
  }

  if (board[nodeIndex] === currentPlayer) {
    state.selectedNode = nodeIndex;
    return;
  }

  if (board[nodeIndex] === null) {
    const validDest = phase === 'flying'
      ? true
      : ADJACENCY[selectedNode].includes(nodeIndex);
    if (validDest) {
      applyMove(state, selectedNode, nodeIndex);
    }
  }
}
