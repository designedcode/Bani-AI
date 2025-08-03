import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import FullShabadDisplay from './components/FullShabadDisplay';
import LoadingOverlay from './components/LoadingOverlay';
import StickyButtons from './components/StickyButtons';
import MetadataPills from './components/MetadataPills';
import TranscriptionPanel from './components/TranscriptionPanel';
import { transcriptionService } from './services/transcriptionService';
import { banidbService } from './services/banidbService';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';



function App() {
  const [shabads, setShabads] = useState<any[]>([]);
  const [searchTriggered] = useState(false);
  const [lastSggsMatchFound, setLastSggsMatchFound] = useState<boolean | null>(null);
  const [lastBestSggsMatch, setLastBestSggsMatch] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(true);
  const [userMessage, setUserMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const shabadsBeingFetched = useRef<Set<number>>(new Set());
  const shabadsLoadedRef = useRef(false); // Track if shabads are loaded
  const transcriptionSentRef = useRef(false); // Track if we've already sent a transcription
  const wordCountTriggeredRef = useRef(false); // Track if 5+ words have been reached
  const [subtitleText, setSubtitleText] = useState('');
  const [showMatchedSubtitle, setShowMatchedSubtitle] = useState(false);
  const MATCH_DISPLAY_DELAY = 1800; // ms

  // Use the new speech recognition hook
  const {
    isListening,
    transcribedText,
    interimTranscript,
    error,
    noSpeechCount,
    volume,
    start: startSpeechRecognition,
    stop: stopSpeechRecognition,
    returnToLoadingOverlay,
    resetTranscription
  } = useSpeechRecognition();

  // Simple function to send transcription data via HTTP (no debouncing)
  const sendTranscription = useCallback(async (text: string, confidence: number) => {
    // Don't send if max no-speech errors reached
    if (noSpeechCount >= 3) {
      return;
    }

    // Don't send if we've already sent a transcription successfully
    if (transcriptionSentRef.current) {
      return;
    }

    // Don't send if already processing
    if (isProcessing) {
      return;
    }

    // IMPORTANT: Don't process transcription if we already have shabads loaded
    if (shabadsLoadedRef.current || searchTriggered) {
      return;
    }

    try {
      setIsProcessing(true);

      // Mark that we're sending a transcription to prevent duplicates
      transcriptionSentRef.current = true;

      const response = await transcriptionService.transcribeAndSearch(text, confidence);

      // Update state with response - only keep what we actually use
      if (response.results && response.results.length > 0) {
        setLastSggsMatchFound(response.sggs_match_found);
        setLastBestSggsMatch(response.best_sggs_match);

        // Fetch full shabad if not already loaded
        const newShabadId = response.results[0].shabad_id;
        if (!shabads.some(s => s.shabad_id === newShabadId) && !shabadsBeingFetched.current.has(newShabadId)) {
          shabadsBeingFetched.current.add(newShabadId);
          try {
            const shabadData = await banidbService.getFullShabad(newShabadId, response.results[0].verse_id);
            setShabads(prev => [...prev, shabadData]);
          } catch (err) {
            console.error('Error fetching full shabad:', err);
          } finally {
            shabadsBeingFetched.current.delete(newShabadId);
          }
        }
      }
    } catch (err) {
      console.error('Transcription error:', err);

      // Check if this is a "no results" error that will trigger page refresh
      if (err instanceof Error && err.message.includes('No results found - page will refresh')) {
        // Don't show error message, just let the page refresh happen
        setUserMessage('No results found. Refreshing...');
      } else {
        setUserMessage('Failed to process transcription');
        // Reset the flag on error so user can try again
        transcriptionSentRef.current = false;
        wordCountTriggeredRef.current = false;
      }
    } finally {
      setIsProcessing(false);
    }
  }, [shabads, searchTriggered, isProcessing, noSpeechCount]);



  // Handle speech recognition results and trigger transcription
  useEffect(() => {
    // Don't process transcription if max no-speech errors reached
    if (noSpeechCount >= 3) {
      return;
    }

    // Check word count on COMBINED final + interim text
    const combinedText = (transcribedText + ' ' + interimTranscript).trim();
    const totalWordCount = combinedText.split(/\s+/).filter(word => word.length > 0).length;

    // Send transcription as soon as we have 5+ words (final or interim), but only once
    if (totalWordCount >= 5 && !wordCountTriggeredRef.current && !shabadsLoadedRef.current && !transcriptionSentRef.current) {
      wordCountTriggeredRef.current = true; // Mark that we've triggered the 5+ word condition
      sendTranscription(combinedText, 0.8); // Default confidence since we don't get it from the hook
    }
  }, [transcribedText, interimTranscript, sendTranscription, noSpeechCount]);

  // Handle speech recognition errors
  useEffect(() => {
    if (error) {
      setUserMessage(`Speech error: ${error}`);
    } else if (!isProcessing) {
      // Only clear message if not processing to avoid clearing processing messages
      setUserMessage('');
    }
  }, [error, isProcessing]);

  // Handle returning to loading overlay when max no-speech errors reached
  useEffect(() => {
    if (noSpeechCount >= 3 && shabads.length > 0) {
      setShowLoader(true);
      
      // Clear shabads to force fresh search
      setShabads([]);
      
      // Aggressively reset ALL transcription-related state
      resetTranscription(); // Clear all transcribed text
      transcriptionSentRef.current = false;
      wordCountTriggeredRef.current = false;
      shabadsLoadedRef.current = false;
      
      // Clear all subtitle and match state immediately
      setSubtitleText('');
      setShowMatchedSubtitle(false);
      setLastSggsMatchFound(null);
      setLastBestSggsMatch(null);
      
      // Force another clear after a brief delay to ensure state updates
      setTimeout(() => {
        setSubtitleText('');
        resetTranscription();
      }, 10);
    }
  }, [noSpeechCount, shabads.length, resetTranscription]);

  // Hide loader as soon as a shabad is found
  useEffect(() => {
    if (shabads.length > 0) {
      setShowLoader(false);
      shabadsLoadedRef.current = true; // Update ref when shabads are loaded
    }
  }, [shabads]);

  // Show live transcription as subtitle during loading
  useEffect(() => {
    // Immediately clear subtitle if max no-speech errors reached
    if (noSpeechCount >= 3) {
      setSubtitleText('');
      return;
    }
    
    if (showLoader && !showMatchedSubtitle && !shabadsLoadedRef.current && noSpeechCount < 3) {
      const subtitle = (transcribedText + ' ' + interimTranscript).trim();
      setSubtitleText(subtitle);
    }
  }, [transcribedText, interimTranscript, showLoader, showMatchedSubtitle, noSpeechCount]);

  // When SGGS match is found, show matched text as subtitle, then transition
  useEffect(() => {
    if (showLoader && lastSggsMatchFound && lastBestSggsMatch) {
      setShowMatchedSubtitle(true);
      setSubtitleText(lastBestSggsMatch);
      const timer = setTimeout(() => {
        setShowLoader(false);
        setShowMatchedSubtitle(false);
      }, MATCH_DISPLAY_DELAY);
      return () => clearTimeout(timer);
    }
  }, [showLoader, lastSggsMatchFound, lastBestSggsMatch]);



  // Function to reset transcription state (for future use)
  const resetTranscriptionState = useCallback(() => {
    setShabads([]);
    resetTranscription(); // Use the hook's reset function
    setLastSggsMatchFound(null);
    setLastBestSggsMatch(null);
    setShowLoader(true);
    shabadsLoadedRef.current = false;
    transcriptionSentRef.current = false; // Reset transcription sent flag
    wordCountTriggeredRef.current = false; // Reset word count trigger flag
  }, [resetTranscription]);

  // Automatically start speech recognition on mount
  useEffect(() => {
    startSpeechRecognition();
  }, [startSpeechRecognition]);

  // Expose reset function for development/testing
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).resetBaniAI = resetTranscriptionState;
      (window as any).returnToLoading = () => {
        setShowLoader(true);
        returnToLoadingOverlay();
      };
    }
  }, [resetTranscriptionState, returnToLoadingOverlay]);

  // Callback to fetch next shabad
  const handleNeedNextShabad = async () => {
    const lastShabad = shabads[shabads.length - 1];
    const nextShabadId = lastShabad?.navigation?.next;
    console.log(`[PAGINATION] Attempting to fetch next shabad. Current: ${lastShabad?.shabad_id}, Next: ${nextShabadId}`);

    if (
      nextShabadId &&
      !shabads.some(s => s.shabad_id === nextShabadId) &&
      !shabadsBeingFetched.current.has(nextShabadId)
    ) {
      console.log(`[PAGINATION] Fetching shabad ${nextShabadId}`);
      shabadsBeingFetched.current.add(nextShabadId);
      try {
        const data = await banidbService.getFullShabad(nextShabadId);
        setShabads(prev => {
          console.log(`[PAGINATION] Successfully fetched shabad ${nextShabadId}, total shabads: ${prev.length + 1}`);
          return [...prev, data];
        });
      } catch (err) {
        console.error('Error fetching next shabad:', err);
      } finally {
        shabadsBeingFetched.current.delete(nextShabadId);
      }
    } else {
      console.log(`[PAGINATION] Skipping fetch - nextShabadId: ${nextShabadId}, already exists: ${shabads.some(s => s.shabad_id === nextShabadId)}, being fetched: ${shabadsBeingFetched.current.has(nextShabadId)}`);
    }
  };

  return (
    <>
      <LoadingOverlay 
        className={showLoader ? '' : 'fade-out'} 
        volume={volume} 
        subtitle={showLoader ? subtitleText : undefined}
      />
      <div style={{ display: showLoader ? 'none' : 'block' }}>
        <div className="App">
          <header className="App-header">
            <h1>ੴ Bani AI</h1>
            <p>Real-time Punjabi Audio Transcription & BaniDB Search</p>
            {userMessage && (
              <div className="user-message" style={{ color: '#ffb347', fontWeight: 600, margin: '1rem 0' }}>
                {userMessage}
              </div>
            )}
            <div className="connection-status">
              <span className={`status-indicator ${isProcessing ? 'connecting' : error ? 'disconnected' : 'connected'}`}>
                {isProcessing ? '🟡' : error ? '🔴' : '🟢'}
              </span>
              <span className="status-text">
                {isProcessing ? 'Processing...' : error ? `Error: ${error}` : isListening ? 'Listening...' : 'Ready for transcription'}
              </span>
            </div>
          </header>

          {/* Sticky Pills + Buttons Row */}
          {shabads.length > 0 && (
            <div className="sticky-header-row">
              <div className="sticky-header-left">
                <MetadataPills
                  raag={shabads[0]?.raag}
                  writer={shabads[0]?.writer}
                  page={shabads[0]?.page_no}
                />
                <StickyButtons />
              </div>
            </div>
          )}

          <main className="App-main">
            {/* Show Full Shabad box if present */}
            {shabads.length > 0 && (
              <div className="panel-header search-results" style={{ marginBottom: '2rem' }}>
                <FullShabadDisplay
                  shabads={shabads}
                  transcribedText={(() => {
                    const combined = (transcribedText + ' ' + interimTranscript).trim();
                    const words = combined.split(/\s+/);
                    const last4Words = words.slice(-4).join(' ');
                    return last4Words;
                  })()}
                  onNeedNextShabad={handleNeedNextShabad}
                />
              </div>
            )}

            {/* Transcription Panel with Mobile Support */}
            <TranscriptionPanel
              transcribedText={transcribedText}
              isListening={isListening}
              error={error}
              onRetry={() => {
                resetTranscription();
                startSpeechRecognition();
              }}
            />
          </main>
        </div>
      </div>
    </>
  );
}

export default App; 