import React from 'react';
import './SacredWordOverlay.css';

interface SacredWordOverlayProps {
  isVisible: boolean;
  sacredWord: string;
  /** Increment this key on every new trigger so the animation restarts instantly */
  overlayKey?: number;
}

/**
 * Sacred Word Overlay
 * -------------------
 * Renders sharply — no fade-in transition delay.
 * The parent provides an ever-incrementing `overlayKey` that forces React to
 * unmount/remount this component each time a new word is detected, which
 * resets the CSS animation to frame 0 with zero delay.
 */
const SacredWordOverlay: React.FC<SacredWordOverlayProps> = ({
  isVisible,
  sacredWord,
  overlayKey = 0,
}) => {
  if (!isVisible && !sacredWord) return null;

  return (
    <div
      key={overlayKey}
      className={`sacred-word-overlay ${isVisible ? 'visible' : 'hiding'}`}
    >
      <div className="sacred-word-content">
        <div className="sacred-word-symbol">ੴ</div>
        <div className="sacred-word-text">{sacredWord}</div>
      </div>
    </div>
  );
};

export default SacredWordOverlay;