import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import FullShabadDisplay from './components/FullShabadDisplay';
import LoadingOverlay from './components/LoadingOverlay';
import StickyButtons from './components/StickyButtons';
import MetadataPills from './components/MetadataPills';
import SacredWordOverlay from './components/SacredWordOverlay';
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
  const [previousShabadId, setPreviousShabadId] = useState<number | null>(null); //New

  const shabadsBeingFetched = useRef<Set<number>>(new Set());
  const shabadsLoadedRef = useRef(false); // Track if shabads are loaded
  const transcriptionSentRef = useRef(false); // Track if we've already sent a transcription
  const wordCountTriggeredRef = useRef(false); // Track if 8+ words have been reached
  const processedWordCountRef = useRef(0); // 👈 tracks how many words already sent
  const [subtitleText, setSubtitleText] = useState('');
  const [showMatchedSubtitle, setShowMatchedSubtitle] = useState(false);
  const MATCH_DISPLAY_DELAY = 1800; // ms

  // Use the new speech recognition hook - keep running even when shabads are loaded
  const {
    isListening,
    transcribedText,
    interimTranscript,
    error,
    noSpeechCount,
    volume,
    start: startSpeechRecognition,
    returnToLoadingOverlay,
    resetTranscription,
    sacredWordOverlay
  } = useSpeechRecognition(shabads.length > 0);

  // Simple function to send transcription data via HTTP (no debouncing)
 const sendTranscription = useCallback(async (text: string, confidence: number) => {
  if (noSpeechCount >= 3) return;
  if (transcriptionSentRef.current) return;
  if (isProcessing) return;
  if (shabadsLoadedRef.current || searchTriggered) return;

  try {
    setIsProcessing(true);
    transcriptionSentRef.current = true;

    const response = await transcriptionService.transcribeAndSearch(text, confidence);

    // 🚫 8 words not ready yet
    if (!response) {
      console.log('[App] Waiting for 8 new words...');
      transcriptionSentRef.current = false;
      setIsProcessing(false);
      return;
    }

    // 🚫 No results returned
    if (!response.results || response.results.length === 0) {
      console.log('[CONFIRMATION] No results found.');
      transcriptionSentRef.current = false;
      wordCountTriggeredRef.current = false;
      setIsProcessing(false);
      return;
    }

    const newShabadId = response.results[0].shabad_id;
    console.log('[CONFIRMATION] Received shabadId:', newShabadId);

  // 🟡 FIRST DETECTION
if (previousShabadId === null) {
  console.log('[CONFIRMATION] 🟡 First detection');
  console.log('[CONFIRMATION] Storing previousShabadId:', newShabadId);

  setPreviousShabadId(newShabadId);
 
  transcriptionSentRef.current = false;
  wordCountTriggeredRef.current = false;
  setIsProcessing(false);
  return;
}

// 🔵 SECOND DETECTION RECEIVED
console.log('[CONFIRMATION] 🔵 Second detection received');
console.log('[CONFIRMATION] Previous:', previousShabadId);
console.log('[CONFIRMATION] New:', newShabadId);

// 🟢 MATCH CONFIRMED
if (previousShabadId === newShabadId) {
  console.log('[CONFIRMATION] ✅ MATCH CONFIRMED');
  console.log('[CONFIRMATION] ShabadId confirmed:', newShabadId);

  setLastSggsMatchFound(response.sggs_match_found ?? null);
  setLastBestSggsMatch(response.best_sggs_match ?? null);

  if (
    !shabads.some(s => s.shabad_id === newShabadId) &&
    !shabadsBeingFetched.current.has(newShabadId)
  ) {
    shabadsBeingFetched.current.add(newShabadId);
    try {
      const shabadData = await banidbService.getFullShabad(newShabadId);
      setShabads(prev => [...prev, shabadData]);
    } catch (err) {
      console.error('Error fetching full shabad:', err);
    } finally {
      shabadsBeingFetched.current.delete(newShabadId);
    }
  }

  console.log('[CONFIRMATION] 🔁 Resetting confirmation cycle');

  setPreviousShabadId(null);
  transcriptionSentRef.current = false;
  wordCountTriggeredRef.current = false;
} 
// 🔴 MISMATCH
else {
  console.log('[CONFIRMATION] ❌ Mismatch detected');
  console.log('[CONFIRMATION] Replacing previousShabadId with:', newShabadId);

  setPreviousShabadId(newShabadId);

  transcriptionSentRef.current = false;
  wordCountTriggeredRef.current = false;
}

  } catch (err) {
    console.error('Transcription error:', err);
    setUserMessage('Failed to process transcription');
    transcriptionSentRef.current = false;
    wordCountTriggeredRef.current = false;
  } finally {
    setIsProcessing(false);
  }
}, [
  shabads,
  searchTriggered,
  isProcessing,
  noSpeechCount,
  previousShabadId
]);


  useEffect(() => {
  if (noSpeechCount >= 3) return;
  
  const combinedText = (transcribedText + ' ' + interimTranscript).trim();
  if (!combinedText) return;

  const words = combinedText.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  console.log('[App] Total words:', totalWords);
  console.log('[App] Already processed:', processedWordCountRef.current);

  // 🔥 Only send if we have 8 NEW words
  if (totalWords - processedWordCountRef.current >= 8) {

    const nextEight = words.slice(
      processedWordCountRef.current,
      processedWordCountRef.current + 8
    );

    const batchText = nextEight.join(' ');

    console.log('🚀 Sending NEW 8 words:', batchText);

    processedWordCountRef.current += 8;

    sendTranscription(batchText, 0.8);
  }

}, [
  transcribedText,
  interimTranscript,
  sendTranscription,
  noSpeechCount,
  
]);

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

  // Show live transcription as subtitle during loading (FILTERED)
  useEffect(() => {
    // Immediately clear subtitle if max no-speech errors reached
    if (noSpeechCount >= 3) {
      setSubtitleText('');
      return;
    }
    
    if (showLoader && !showMatchedSubtitle && !shabadsLoadedRef.current && noSpeechCount < 3) {
      // Use pre-filtered text from speech recognition hook
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
    processedWordCountRef.current = 0; // Reset processed word count
  }, [resetTranscription]);

  // Automatically start speech recognition on mount - SpeechRecognitionManager handles all restarts internally
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
  const handleNeedNextShabad = useCallback(async () => {
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
  }, [shabads]);

  return (
    <>
      <LoadingOverlay 
        className={showLoader ? '' : 'fade-out'} 
        volume={volume} 
        subtitle={showLoader ? subtitleText : undefined}
      />
      <SacredWordOverlay
        isVisible={sacredWordOverlay.isVisible}
        sacredWord={sacredWordOverlay.sacredWord}
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
                    // Use pre-filtered text from speech recognition hook
                    const combined = (transcribedText + ' ' + interimTranscript).trim();
                    const words = combined.split(/\s+/);
                    const last4Words = words.slice(-4).join(' ');
                    return last4Words;
                  })()}
                  onNeedNextShabad={handleNeedNextShabad}
                />
              </div>
            )}

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default App;     