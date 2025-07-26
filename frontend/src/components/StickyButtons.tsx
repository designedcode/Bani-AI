import React, { useCallback, useState } from 'react';
import './StickyButtons.css';

const StickyButtons: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen API handler
  const handleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // Listen for fullscreen change to update state
  React.useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      ));
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    document.addEventListener('msfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      document.removeEventListener('msfullscreenchange', onChange);
    };
  }, []);

  // Reset handler
  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset? This will reload the page.')) {
      window.location.reload();
    }
  }, []);

  return (
    <div className="sticky-buttons">
      <button
        className="reset-btn"
        onClick={handleReset}
        aria-label="Reset UI"
        title="Reset UI"
      >
        Reset
      </button>
      <button
        className="fullscreen-btn"
        onClick={handleFullscreen}
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {/* Simple fullscreen SVG icon */}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="5" height="2" rx="1" fill="#bbb" />
          <rect x="3" y="3" width="2" height="5" rx="1" fill="#bbb" />
          <rect x="14" y="3" width="5" height="2" rx="1" fill="#bbb" />
          <rect x="17" y="3" width="2" height="5" rx="1" fill="#bbb" />
          <rect x="3" y="17" width="5" height="2" rx="1" fill="#bbb" />
          <rect x="3" y="14" width="2" height="5" rx="1" fill="#bbb" />
          <rect x="14" y="17" width="5" height="2" rx="1" fill="#bbb" />
          <rect x="17" y="14" width="2" height="5" rx="1" fill="#bbb" />
        </svg>
      </button>
    </div>
  );
};

export default StickyButtons; 