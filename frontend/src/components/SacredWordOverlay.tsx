import React from 'react';
import './SacredWordOverlay.css';

interface SacredWordOverlayProps {
  isVisible: boolean;
  sacredWord: string;
  onAnimationEnd?: () => void;
}

const SacredWordOverlay: React.FC<SacredWordOverlayProps> = ({
  isVisible,
  sacredWord,
  onAnimationEnd
}) => {
  if (!isVisible && !sacredWord) return null;

  return (
    <div 
      className={`sacred-word-overlay ${isVisible ? 'visible' : 'hidden'}`}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="sacred-word-content">
        <div className="sacred-word-symbol">ੴ</div>
        <div className="sacred-word-text">{sacredWord}</div>
      </div>
    </div>
  );
};

export default SacredWordOverlay;