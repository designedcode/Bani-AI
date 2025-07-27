import React from 'react';
import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'spinner' | 'dots' | 'pulse';
  className?: string;
  inline?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'medium',
  variant = 'spinner',
  className = '',
  inline = false
}) => {
  const renderSpinner = () => (
    <div className={`loading-spinner ${size}`}>
      <div className="spinner-ring"></div>
    </div>
  );

  const renderDots = () => (
    <div className={`loading-dots ${size}`}>
      <div className="dot"></div>
      <div className="dot"></div>
      <div className="dot"></div>
    </div>
  );

  const renderPulse = () => (
    <div className={`loading-pulse ${size}`}>
      <div className="pulse-circle"></div>
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  if (inline) {
    return (
      <span className={`loading-state inline ${className}`}>
        {renderLoader()}
        {message && <span className="loading-message">{message}</span>}
      </span>
    );
  }

  return (
    <div className={`loading-state ${className}`}>
      <div className="loading-content">
        {renderLoader()}
        {message && <div className="loading-message">{message}</div>}
      </div>
    </div>
  );
};

export default LoadingState;