import React from 'react';
import { ApiError, ErrorType } from '../types/SearchTypes';
import './ErrorMessage.css';

interface ErrorMessageProps {
  error: ApiError | Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
  className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  onDismiss,
  showRetry = true,
  className = ''
}) => {
  const getErrorDetails = () => {
    if (typeof error === 'string') {
      return {
        type: ErrorType.API_ERROR,
        message: error,
        userMessage: error,
        icon: '⚠️'
      };
    }

    if (error instanceof Error) {
      return {
        type: ErrorType.API_ERROR,
        message: error.message,
        userMessage: 'An unexpected error occurred. Please try again.',
        icon: '⚠️'
      };
    }

    // ApiError
    const apiError = error as ApiError;
    let userMessage = '';
    let icon = '⚠️';

    switch (apiError.type) {
      case ErrorType.NETWORK_ERROR:
        userMessage = 'Network connection failed. Please check your internet connection and try again.';
        icon = '🌐';
        break;
      case ErrorType.API_ERROR:
        if (apiError.code === 404) {
          userMessage = 'The requested content was not found.';
          icon = '🔍';
        } else if (apiError.code === 429) {
          userMessage = 'Too many requests. Please wait a moment and try again.';
          icon = '⏱️';
        } else if (apiError.code === 500) {
          userMessage = 'Server error. Please try again later.';
          icon = '🔧';
        } else {
          userMessage = 'API request failed. Please try again.';
          icon = '🔌';
        }
        break;
      case ErrorType.WEBSOCKET_ERROR:
        userMessage = 'Connection to transcription service failed. Please refresh the page.';
        icon = '🔗';
        break;
      case ErrorType.DATA_LOADING_ERROR:
        userMessage = 'Failed to load data. Please refresh the page or try again.';
        icon = '📄';
        break;
      case ErrorType.SEARCH_ERROR:
        userMessage = 'Search failed. Please try a different query or try again.';
        icon = '🔍';
        break;
      case ErrorType.TRANSCRIPTION_ERROR:
        userMessage = 'Transcription processing failed. Please try speaking again.';
        icon = '🎤';
        break;
      case ErrorType.VALIDATION_ERROR:
        userMessage = 'Invalid input. Please check your input and try again.';
        icon = '✏️';
        break;
      default:
        userMessage = 'An error occurred. Please try again.';
        icon = '⚠️';
    }

    return {
      type: apiError.type,
      message: apiError.message,
      userMessage,
      icon,
      code: apiError.code,
      timestamp: apiError.timestamp
    };
  };

  const errorDetails = getErrorDetails();

  return (
    <div className={`error-message ${className}`}>
      <div className="error-message-content">
        <div className="error-message-header">
          <span className="error-icon">{errorDetails.icon}</span>
          <span className="error-title">Error</span>
          {onDismiss && (
            <button 
              className="error-dismiss"
              onClick={onDismiss}
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="error-message-body">
          <p className="error-user-message">{errorDetails.userMessage}</p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="error-technical-details">
              <summary>Technical Details</summary>
              <div className="error-details-content">
                <p><strong>Type:</strong> {errorDetails.type}</p>
                <p><strong>Message:</strong> {errorDetails.message}</p>
                {errorDetails.code && <p><strong>Code:</strong> {errorDetails.code}</p>}
                {errorDetails.timestamp && (
                  <p><strong>Time:</strong> {new Date(errorDetails.timestamp).toLocaleString()}</p>
                )}
              </div>
            </details>
          )}
        </div>

        {(showRetry && onRetry) && (
          <div className="error-message-actions">
            <button 
              className="error-retry-button"
              onClick={onRetry}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;