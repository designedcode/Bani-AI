import React, { useState } from 'react';
import './MobileSpeechHelper.css';

interface MobileSpeechHelperProps {
  error: string;
  isMobile: boolean;
  onRetry: () => void;
}

export const MobileSpeechHelper: React.FC<MobileSpeechHelperProps> = ({ 
  error, 
  isMobile, 
  onRetry 
}) => {
  const [showHelp, setShowHelp] = useState(false);

  const isHTTPS = location.protocol === 'https:';
  const isMobileChrome = isMobile && /Chrome/.test(navigator.userAgent);

  const getTroubleshootingSteps = () => {
    const steps = [];
    
    if (!isHTTPS) {
      steps.push('🔒 Enable HTTPS: Web Speech API requires HTTPS on mobile devices');
    }
    
    if (error.includes('permission') || error.includes('not-allowed')) {
      steps.push('🎤 Enable microphone: Go to Chrome Settings > Site Settings > Microphone > Allow');
      steps.push('🔄 Refresh the page after enabling microphone permissions');
    }
    
    if (error.includes('network')) {
      steps.push('🌐 Check internet connection: Ensure you have a stable internet connection');
    }
    
    if (steps.length === 0) {
      steps.push('📱 Try refreshing the page');
      steps.push('🔊 Speak clearly and ensure microphone is working');
      steps.push('⏱️ Wait a few seconds before trying again');
    }
    
    return steps;
  };

  if (!isMobileChrome) {
    return null;
  }

  return (
    <div className="mobile-speech-helper">
      {error && (
        <div className="mobile-error">
          <div className="error-header">
            <span className="error-icon">⚠️</span>
            <span className="error-title">Mobile Chrome Issue</span>
            <button 
              className="help-toggle"
              onClick={() => setShowHelp(!showHelp)}
            >
              {showHelp ? 'Hide Help' : 'Show Help'}
            </button>
          </div>
          
          <div className="error-message">{error}</div>
          
          {showHelp && (
            <div className="troubleshooting">
              <h4>How to fix:</h4>
              <ul>
                {getTroubleshootingSteps().map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
              
              <div className="action-buttons">
                <button onClick={onRetry} className="retry-btn">
                  🔄 Try Again
                </button>
                <button 
                  onClick={() => window.location.reload()} 
                  className="refresh-btn"
                >
                  🔄 Refresh Page
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 