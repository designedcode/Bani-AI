import React from 'react';
import './TranscriptionPanel.css';

interface TranscriptionPanelProps {
  transcribedText: string;
  isListening: boolean;
}

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ 
  transcribedText, 
  isListening 
}) => {
  return (
    <div className="transcription-panel">
      <div className="panel-header">
        <h3>🎤 Live Transcription</h3>
        <div className={`listening-indicator ${isListening ? 'active' : ''}`}>
          {isListening ? '🔴 Recording...' : '⚪ Idle'}
        </div>
      </div>
      
      <div className="transcription-content">
        {transcribedText ? (
          <div className="transcribed-text gurmukhi-text">
            {transcribedText}
          </div>
        ) : (
          <div className="placeholder-text">
            {isListening 
              ? 'Listening for Punjabi speech...' 
              : 'Click "Start Listening" to begin transcription'
            }
          </div>
        )}
      </div>
      
      {transcribedText && (
        <div className="transcription-stats">
          <span>Characters: {transcribedText.length}</span>
          <span>Words: {transcribedText.split(/\s+/).filter(word => word.length > 0).length}</span>
        </div>
      )}
    </div>
  );
};

export default TranscriptionPanel; 