// Chess Engine - handles all game logic

export const PIECES = {
  KING: 'K', QUEEN: 'Q', ROOK: 'R',
  BISHOP: 'B', KNIGHT: 'N', PAWN: 'P',
};
export const COLORS = { WHITE: 'w', BLACK: 'b' };

const INITIAL_BOARD = [
  [
    { type: 'R', color: 'b' }, { type: 'N', color: 'b' }, { type: 'B', color: 'b' },
    { type: 'Q', color: 'b' }, { type: 'K', color: 'b' }, { type: 'B', color: 'b' },
    { type: 'N', color: 'b' }, { type: 'R', color: 'b' },
  ],
  Array(8).fill(null).map(() => ({ type: 'P', color: 'b' })),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null).map(() => ({ type: 'P', color: 'w' })),
  [
    { type: 'R', color: 'w' }, { type: 'N', color: 'w' }, { type: 'B', color: 'w' },
    { type: 'Q', color: 'w' }, { type: 'K', color: 'w' }, { type: 'B', color: 'w' },
    { type: 'N', color: 'w' }, { type: 'R', color: 'w' },
  ],
];

export function createInitialState() {
  return {
    board: INITIAL_BOARD.map(row => row.map(cell => cell ? { ...cell } : null)),
    turn: 'w',
    selected: null,
    legalMoves: [],
    enPassantTarget: null, // [row, col] square that can be captured en passant
    castlingRights: {
      w: { kingSide: true, queenSide: true },
      b: { kingSide: true, queenSide: true },
    },
    status: 'playing', // 'playing' | 'check' | 'checkmate' | 'stalemate'
    capturedPieces: { w: [], b: [] },
    moveHistory: [],
    promotionPending: null, // { from, to }
  };
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

function isOpponent(piece, color) {
  return piece && piece.color !== color;
}

function isEmpty(board, r, c) {
  return inBounds(r, c) && board[r][c] === null;
}

function isOccupiedByOpponent(board, r, c, color) {
  return inBounds(r, c) && board[r][c] && board[r][c].color !== color;
}

// Raw moves (without checking for resulting check)
function rawMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const { type, color } = piece;
  const moves = [];

  const addSliding = (dr, dc) => {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      if (board[nr][nc] === null) {
        moves.push([nr, nc]);
      } else {
        if (isOpponent(board[nr][nc], color)) moves.push([nr, nc]);
        break;
      }
      nr += dr; nc += dc;
    }
  };

  switch (type) {
    case 'P': {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      if (isEmpty(board, r + dir, c)) {
        moves.push([r + dir, c]);
        if (r === startRow && isEmpty(board, r + 2 * dir, c)) {
          moves.push([r + 2 * dir, c]);
        }
      }
      for (const dc of [-1, 1]) {
        if (isOccupiedByOpponent(board, r + dir, c + dc, color)) {
          moves.push([r + dir, c + dc]);
        }
      }
      break;
    }
    case 'N':
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        if (inBounds(r+dr, c+dc) && !( board[r+dr][c+dc]?.color === color)) {
          moves.push([r+dr, c+dc]);
        }
      }
      break;
    case 'B':
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) addSliding(dr, dc);
      break;
    case 'R':
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) addSliding(dr, dc);
      break;
    case 'Q':
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) addSliding(dr, dc);
      break;
    case 'K':
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        if (inBounds(r+dr, c+dc) && board[r+dr][c+dc]?.color !== color) {
          moves.push([r+dr, c+dc]);
        }
      }
      break;
    default:
      break;
  }

  return moves;
}

function isSquareAttacked(board, r, c, byColor) {
  // Check if any piece of byColor attacks square [r,c]
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row][col];
      if (p && p.color === byColor) {
        const moves = rawMoves(board, row, col);
        if (moves.some(([mr, mc]) => mr === r && mc === c)) return true;
      }
    }
  }
  return false;
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c]?.color === color) return [r, c];
  return null;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  const opp = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, king[0], king[1], opp);
}

function applyMove(board, from, to) {
  const nb = cloneBoard(board);
  nb[to[0]][to[1]] = nb[from[0]][from[1]];
  nb[from[0]][from[1]] = null;
  return nb;
}

// Legal moves (filters moves that leave king in check), includes castling & en passant
export function getLegalMoves(state, r, c) {
  const { board, castlingRights, enPassantTarget } = state;
  const piece = board[r][c];
  if (!piece) return [];

  const { color } = piece;
  let moves = rawMoves(board, r, c);

  // Add en passant captures
  if (piece.type === 'P' && enPassantTarget) {
    const dir = color === 'w' ? -1 : 1;
    const [epr, epc] = enPassantTarget;
    if (r + dir === epr && (c - 1 === epc || c + 1 === epc)) {
      moves.push([epr, epc]);
    }
  }

  // Filter moves that put own king in check
  const oppColor = color === 'w' ? 'b' : 'w';
  let legal = moves.filter(([tr, tc]) => {
    let nb = cloneBoard(board);
    nb[tr][tc] = nb[r][c];
    nb[r][c] = null;

    // En passant: also remove the captured pawn
    if (piece.type === 'P' && enPassantTarget && tr === enPassantTarget[0] && tc === enPassantTarget[1]) {
      const capturedPawnRow = color === 'w' ? tr + 1 : tr - 1;
      nb[capturedPawnRow][tc] = null;
    }

    const king = findKing(nb, color);
    if (!king) return false;
    return !isSquareAttacked(nb, king[0], king[1], oppColor);
  });

  // Castling
  if (piece.type === 'K') {
    const row = color === 'w' ? 7 : 0;
    if (r === row && c === 4) {
      const rights = castlingRights[color];
      // King-side
      if (rights.kingSide &&
          board[row][5] === null && board[row][6] === null &&
          !isInCheck(board, color) &&
          !isSquareAttacked(board, row, 5, oppColor) &&
          !isSquareAttacked(board, row, 6, oppColor)) {
        legal.push([row, 6]);
      }
      // Queen-side
      if (rights.queenSide &&
          board[row][3] === null && board[row][2] === null && board[row][1] === null &&
          !isInCheck(board, color) &&
          !isSquareAttacked(board, row, 3, oppColor) &&
          !isSquareAttacked(board, row, 2, oppColor)) {
        legal.push([row, 2]);
      }
    }
  }

  return legal;
}

export function applyLegalMove(state, from, to) {
  const { board, turn, castlingRights, enPassantTarget } = state;
  const piece = board[from[0]][from[1]];
  if (!piece) return state;

  const nb = cloneBoard(board);
  const newCaptured = { w: [...state.capturedPieces.w], b: [...state.capturedPieces.b] };
  const newCastling = {
    w: { ...castlingRights.w },
    b: { ...castlingRights.b },
  };
  let newEnPassant = null;
  let promotionPending = null;

  // Track captured piece
  if (nb[to[0]][to[1]]) {
    newCaptured[turn].push(nb[to[0]][to[1]]);
  }

  // En passant capture
  if (piece.type === 'P' && enPassantTarget &&
      to[0] === enPassantTarget[0] && to[1] === enPassantTarget[1]) {
    const capturedRow = turn === 'w' ? to[0] + 1 : to[0] - 1;
    newCaptured[turn].push(nb[capturedRow][to[1]]);
    nb[capturedRow][to[1]] = null;
  }

  // Move the piece
  nb[to[0]][to[1]] = { ...piece };
  nb[from[0]][from[1]] = null;

  // Set en passant target for double pawn push
  if (piece.type === 'P' && Math.abs(to[0] - from[0]) === 2) {
    newEnPassant = [(from[0] + to[0]) / 2, from[1]];
  }

  // Castling: move the rook too
  if (piece.type === 'K') {
    const row = turn === 'w' ? 7 : 0;
    if (from[1] === 4 && to[1] === 6) {
      // King-side castle
      nb[row][5] = nb[row][7];
      nb[row][7] = null;
    } else if (from[1] === 4 && to[1] === 2) {
      // Queen-side castle
      nb[row][3] = nb[row][0];
      nb[row][0] = null;
    }
    newCastling[turn].kingSide = false;
    newCastling[turn].queenSide = false;
  }

  // Update castling rights when rook moves
  if (piece.type === 'R') {
    if (from[0] === 7 && from[1] === 7) newCastling.w.kingSide = false;
    if (from[0] === 7 && from[1] === 0) newCastling.w.queenSide = false;
    if (from[0] === 0 && from[1] === 7) newCastling.b.kingSide = false;
    if (from[0] === 0 && from[1] === 0) newCastling.b.queenSide = false;
  }

  // Pawn promotion
  if (piece.type === 'P' && (to[0] === 0 || to[0] === 7)) {
    promotionPending = { from, to };
  }

  const nextTurn = turn === 'w' ? 'b' : 'w';

  // Build new state
  const newState = {
    ...state,
    board: nb,
    turn: nextTurn,
    selected: null,
    legalMoves: [],
    enPassantTarget: newEnPassant,
    castlingRights: newCastling,
    capturedPieces: newCaptured,
    moveHistory: [...state.moveHistory, { from, to, piece }],
    promotionPending,
  };

  // Compute status
  if (!promotionPending) {
    newState.status = computeStatus(nb, nextTurn);
  } else {
    newState.status = 'playing';
  }

  return newState;
}

export function promotePawn(state, pieceType) {
  if (!state.promotionPending) return state;
  const { to } = state.promotionPending;
  const nb = cloneBoard(state.board);
  nb[to[0]][to[1]] = { type: pieceType, color: state.turn === 'w' ? 'b' : 'w' };
  // turn was already switched in applyLegalMove
  const currentTurn = state.turn;
  const status = computeStatus(nb, currentTurn);
  return { ...state, board: nb, promotionPending: null, status };
}

function computeStatus(board, turn) {
  const hasLegal = hasAnyLegalMove(board, turn);
  if (isInCheck(board, turn)) {
    return hasLegal ? 'check' : 'checkmate';
  }
  return hasLegal ? 'playing' : 'stalemate';
}

function hasAnyLegalMove(board, color) {
  const oppColor = color === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const raw = rawMoves(board, r, c);
        for (const [tr, tc] of raw) {
          const nb = applyMove(board, [r, c], [tr, tc]);
          const king = findKing(nb, color);
          if (king && !isSquareAttacked(nb, king[0], king[1], oppColor)) return true;
        }
        // Also check castling for king
        if (p.type === 'K') {
          const row = color === 'w' ? 7 : 0;
          if (!isInCheck(board, color)) {
            if (board[row][5] === null && board[row][6] === null &&
                !isSquareAttacked(board, row, 5, oppColor) &&
                !isSquareAttacked(board, row, 6, oppColor)) return true;
            if (board[row][3] === null && board[row][2] === null && board[row][1] === null &&
                !isSquareAttacked(board, row, 3, oppColor) &&
                !isSquareAttacked(board, row, 2, oppColor)) return true;
          }
        }
      }
    }
  }
  return false;
}
