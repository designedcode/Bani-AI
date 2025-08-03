import { useState, useEffect, useCallback, useRef } from 'react';
import { speechRecognitionManager } from '../services/speechRecognitionManager';
import { SpeechState, SpeechRecognitionResult } from '../types/speechRecognition';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcribedText: string;
  interimTranscript: string;
  error: string;
  noSpeechCount: number;
  speechState: SpeechState;
  volume: number;
  start: () => void;
  stop: () => void;
  returnToLoadingOverlay: () => void;
  resetTranscription: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [noSpeechCount, setNoSpeechCount] = useState(0);
  const [speechState, setSpeechState] = useState<SpeechState>(SpeechState.IDLE);
  const [volume, setVolume] = useState(0);
  
  const volumeUpdateRef = useRef<number | null>(null);

  // Initialize speech recognition manager
  useEffect(() => {
    console.log('[useSpeechRecognition] === INITIALIZATION STARTED ===');
    
    const isMobileChrome = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && 
                           /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
    
    console.log('[useSpeechRecognition] Mobile Chrome detected:', isMobileChrome);
    
    // Use mobile-specific initialization for mobile Chrome
    const initialized = isMobileChrome ? 
      speechRecognitionManager.initializeForMobile() : 
      speechRecognitionManager.initialize();
      
    console.log('[useSpeechRecognition] Initialization result:', initialized);
      
    if (!initialized) {
      console.log('[useSpeechRecognition] Initialization failed');
      setError('Speech recognition not supported in this browser');
      return;
    }

    // Set up event listeners
    speechRecognitionManager.on('stateChange', (state) => {
      console.log('[useSpeechRecognition] State changed to:', state);
      setSpeechState(state);
      setIsListening(state === SpeechState.LISTENING);
      
      // Clear error when successfully listening
      if (state === SpeechState.LISTENING) {
        console.log('[useSpeechRecognition] Clearing error on listening state');
        setError('');
      }
    });

    speechRecognitionManager.on('result', (result: SpeechRecognitionResult) => {
      console.log('[useSpeechRecognition] Result received:', result);
      if (result.isFinal) {
        console.log('[useSpeechRecognition] Final result, updating transcribedText');
        setTranscribedText(prev => prev + result.transcript);
        setInterimTranscript(''); // Clear interim when we get final result
      } else {
        console.log('[useSpeechRecognition] Interim result, updating interimTranscript');
        setInterimTranscript(result.transcript);
      }
    });

    speechRecognitionManager.on('error', (errorMessage) => {
      setError(errorMessage);
      
      // Mobile-specific error handling
      if (errorMessage.includes('HTTPS') || errorMessage.includes('permission')) {
        console.log('[useSpeechRecognition] Mobile-specific error detected:', errorMessage);
      }
    });

    speechRecognitionManager.on('noSpeechCount', (count) => {
      setNoSpeechCount(count);
    });

    speechRecognitionManager.on('maxEndsReached', () => {
      // Immediately and aggressively clear all transcription when max ends reached
      setTranscribedText('');
      setInterimTranscript('');
      setError('');
      
      // Force a synchronous clear by using a timeout to ensure state updates
      setTimeout(() => {
        setTranscribedText('');
        setInterimTranscript('');
      }, 0);
    });

    // Start volume monitoring (disabled for mobile)
    const updateVolume = () => {
      const currentVolume = speechRecognitionManager.getCurrentVolume();
      setVolume(currentVolume);
      volumeUpdateRef.current = requestAnimationFrame(updateVolume);
    };
    
    // Only start volume monitoring for non-mobile
    if (!isMobileChrome) {
      console.log('[useSpeechRecognition] Starting volume monitoring');
      updateVolume();
    } else {
      console.log('[useSpeechRecognition] Skipping volume monitoring for mobile');
    }

    return () => {
      if (volumeUpdateRef.current) {
        cancelAnimationFrame(volumeUpdateRef.current);
      }
      speechRecognitionManager.cleanup();
    };
  }, []);

  const start = useCallback(() => {
    console.log('[useSpeechRecognition] === START FUNCTION CALLED ===');
    
    const isMobileChrome = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && 
                           /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
    
    console.log('[useSpeechRecognition] Mobile Chrome detected:', isMobileChrome);
    
    if (isMobileChrome) {
      console.log('[useSpeechRecognition] Using mobile-specific start method');
      // Use mobile-specific start method
      speechRecognitionManager.startForMobile();
    } else {
      console.log('[useSpeechRecognition] Using regular start method');
      speechRecognitionManager.start();
    }
  }, []);

  const stop = useCallback(() => {
    speechRecognitionManager.stop();
  }, []);

  const returnToLoadingOverlay = useCallback(() => {
    speechRecognitionManager.returnToLoadingOverlay();
  }, []);

  const resetTranscription = useCallback(() => {
    setTranscribedText('');
    setInterimTranscript('');
    setError('');
    setNoSpeechCount(0);
  }, []);

  return {
    isListening,
    transcribedText,
    interimTranscript,
    error,
    noSpeechCount,
    speechState,
    volume,
    start,
    stop,
    returnToLoadingOverlay,
    resetTranscription
  };
}