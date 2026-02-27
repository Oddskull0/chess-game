import { useState, useCallback } from 'react';
import {
  createInitialState,
  getLegalMoves,
  applyLegalMove,
  promotePawn,
} from '../chess/engine';
import PromotionModal from './PromotionModal';
import './ChessBoard.css';

const PIECE_UNICODE = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export default function ChessBoard() {
  const [gameState, setGameState] = useState(() => createInitialState());

  const handleSquareClick = useCallback((row, col) => {
    if (gameState.status === 'checkmate' || gameState.status === 'stalemate') return;
    if (gameState.promotionPending) return;

    const piece = gameState.board[row][col];
    const { selected, legalMoves, turn } = gameState;

    // If a square was already selected, try to move there
    if (selected) {
      const isLegal = legalMoves.some(([r, c]) => r === row && c === col);
      if (isLegal) {
        const newState = applyLegalMove(gameState, selected, [row, col]);
        setGameState(newState);
        return;
      }
    }

    // Select a piece of the current player
    if (piece && piece.color === turn) {
      const moves = getLegalMoves(gameState, row, col);
      setGameState(s => ({ ...s, selected: [row, col], legalMoves: moves }));
      return;
    }

    // Deselect
    setGameState(s => ({ ...s, selected: null, legalMoves: [] }));
  }, [gameState]);

  const handlePromotion = useCallback((pieceType) => {
    setGameState(s => promotePawn(s, pieceType));
  }, []);

  const handleReset = useCallback(() => {
    setGameState(createInitialState());
  }, []);

  const { board, selected, legalMoves, status, turn, capturedPieces } = gameState;
  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));

  const statusText = () => {
    if (status === 'checkmate') return `Checkmate! ${turn === 'w' ? 'Black' : 'White'} wins! 🏆`;
    if (status === 'stalemate') return "Stalemate! It's a draw. 🤝";
    if (status === 'check') return `${turn === 'w' ? 'White' : 'Black'} is in Check! ⚠️`;
    return `${turn === 'w' ? 'White' : 'Black'}'s turn`;
  };

  const renderCaptured = (color) => {
    return capturedPieces[color].map((p, i) => (
      <span key={i} className="captured-piece">{PIECE_UNICODE[p.color + p.type]}</span>
    ));
  };

  return (
    <div className="chess-container">
      <h1 className="chess-title">♟ Chess</h1>

      <div className="status-bar" data-status={status}>
        {statusText()}
      </div>

      <div className="captured-row">
        <span className="captured-label">Black captured:</span>
        {renderCaptured('b')}
      </div>

      <div className="board-wrapper">
        {/* Rank labels left */}
        <div className="rank-labels">
          {RANKS.map(r => <div key={r} className="rank-label">{r}</div>)}
        </div>

        <div className="board">
          {board.map((row, rowIdx) =>
            row.map((piece, colIdx) => {
              const isLight = (rowIdx + colIdx) % 2 === 0;
              const isSelected = selected && selected[0] === rowIdx && selected[1] === colIdx;
              const isLegal = legalSet.has(`${rowIdx},${colIdx}`);
              const isOccupied = piece !== null;
              const isCapture = isLegal && isOccupied;

              let classes = `square ${isLight ? 'light' : 'dark'}`;
              if (isSelected) classes += ' selected';
              if (isLegal && !isCapture) classes += ' legal-move';
              if (isCapture) classes += ' legal-capture';

              return (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className={classes}
                  onClick={() => handleSquareClick(rowIdx, colIdx)}
                >
                  {piece && (
                    <span className={`piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`}>
                      {PIECE_UNICODE[piece.color + piece.type]}
                    </span>
                  )}
                  {isLegal && !isCapture && <span className="move-dot" />}
                </div>
              );
            })
          )}
        </div>

        {/* Rank labels right */}
        <div className="rank-labels">
          {RANKS.map(r => <div key={r} className="rank-label">{r}</div>)}
        </div>
      </div>

      {/* File labels */}
      <div className="file-labels-wrapper">
        <div className="file-labels-spacer" />
        <div className="file-labels">
          {FILES.map(f => <div key={f} className="file-label">{f}</div>)}
        </div>
        <div className="file-labels-spacer" />
      </div>

      <div className="captured-row">
        <span className="captured-label">White captured:</span>
        {renderCaptured('w')}
      </div>

      <button className="reset-btn" onClick={handleReset}>New Game</button>

      {gameState.promotionPending && (
        <PromotionModal
          color={turn === 'w' ? 'b' : 'w'}
          onSelect={handlePromotion}
        />
      )}
    </div>
  );
}
