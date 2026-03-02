import React from 'react';
import './SacredWordOverlay.css';

interface SacredWordOverlayProps {
  isVisible: boolean;
  sacredWord: string;
  matchId?: string | number; // Unique ID to force re-animation
  onAnimationEnd?: () => void;
}

const SacredWordOverlay: React.FC<SacredWordOverlayProps> = ({
  isVisible,
  sacredWord,
  matchId,
  onAnimationEnd
}) => {
  // We keep the node mounted but hidden so CSS transitions can play out.
  // The 'isVisible' class handles the fade out, while key={matchId} handles the fade in.

  return (
    <div
      className={`sacred-word-overlay ${isVisible ? 'visible' : 'hidden'}`}
    >
      {sacredWord && (
        <div
          key={matchId || sacredWord}
          className="sacred-word-content"
          onAnimationEnd={onAnimationEnd}
        >
          <div className="sacred-word-symbol">ੴ</div>
          <div className="sacred-word-text">{sacredWord}</div>
        </div>
      )}
    </div>
  );
};

export default SacredWordOverlay;