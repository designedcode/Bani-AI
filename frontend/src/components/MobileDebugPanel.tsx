import React, { useState, useEffect } from 'react';
import './MobileDebugPanel.css';

interface MobileDebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export const MobileDebugPanel: React.FC<MobileDebugPanelProps> = ({ 
  isVisible, 
  onClose 
}) => {
  const [debugInfo, setDebugInfo] = useState({
    userAgent: '',
    isMobile: false,
    isChrome: false,
    isHTTPS: false,
    hasSpeechAPI: false,
    protocol: '',
    host: ''
  });

  useEffect(() => {
    if (isVisible) {
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
      const isHTTPS = window.location.protocol === 'https:';
      const hasSpeechAPI = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);

      setDebugInfo({
        userAgent,
        isMobile,
        isChrome,
        isHTTPS,
        hasSpeechAPI,
        protocol: window.location.protocol,
        host: window.location.host
      });
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="mobile-debug-overlay">
      <div className="mobile-debug-panel">
        <div className="debug-header">
          <h3>🔧 Mobile Debug Info</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        
        <div className="debug-content">
          <div className="debug-section">
            <h4>Browser Info</h4>
            <div className="debug-item">
              <span className="label">Mobile:</span>
              <span className={`value ${debugInfo.isMobile ? 'success' : 'error'}`}>
                {debugInfo.isMobile ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="debug-item">
              <span className="label">Chrome:</span>
              <span className={`value ${debugInfo.isChrome ? 'success' : 'error'}`}>
                {debugInfo.isChrome ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="debug-item">
              <span className="label">HTTPS:</span>
              <span className={`value ${debugInfo.isHTTPS ? 'success' : 'error'}`}>
                {debugInfo.isHTTPS ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="debug-item">
              <span className="label">Speech API:</span>
              <span className={`value ${debugInfo.hasSpeechAPI ? 'success' : 'error'}`}>
                {debugInfo.hasSpeechAPI ? 'Supported' : 'Not Supported'}
              </span>
            </div>
          </div>

          <div className="debug-section">
            <h4>Connection</h4>
            <div className="debug-item">
              <span className="label">Protocol:</span>
              <span className="value">{debugInfo.protocol}</span>
            </div>
            <div className="debug-item">
              <span className="label">Host:</span>
              <span className="value">{debugInfo.host}</span>
            </div>
          </div>
        </div>

        <div className="debug-actions">
          <button onClick={() => window.location.reload()} className="action-btn">
            🔄 Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}; 