import './PromotionModal.css';

const PIECES = ['Q', 'R', 'B', 'N'];
const UNICODE = {
  wQ: '♕', wR: '♖', wB: '♗', wN: '♘',
  bQ: '♛', bR: '♜', bB: '♝', bN: '♞',
};

export default function PromotionModal({ color, onSelect }) {
  return (
    <div className="promotion-overlay">
      <div className="promotion-modal">
        <h2>Promote Pawn</h2>
        <p>Choose a piece:</p>
        <div className="promotion-choices">
          {PIECES.map(p => (
            <button
              key={p}
              className="promotion-choice"
              onClick={() => onSelect(p)}
            >
              {UNICODE[color + p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
