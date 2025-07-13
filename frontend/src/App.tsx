import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import TranscriptionPanel from './components/TranscriptionPanel';
import SearchResults from './components/SearchResults';
import AudioVisualizer from './components/AudioVisualizer';
import FullShabadDisplay from './components/FullShabadDisplay';

interface SearchResult {
  gurmukhi_text: string;
  english_translation: string;
  line_number: number;
  page_number: number;
  source?: string;
  writer?: string;
  raag?: string;
  shabad_id: string;
}

interface TranscriptionData {
  text: string;
  confidence: number;
}

function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string>('');
  const [sggsMatchFound, setSggsMatchFound] = useState<boolean | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState<boolean | null>(null);
  const [bestSggsMatch, setBestSggsMatch] = useState<string | null>(null);
  const [bestSggsScore, setBestSggsScore] = useState<number | null>(null);
  const [shabads, setShabads] = useState<any[]>([]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [lastSearchResults, setLastSearchResults] = useState<SearchResult[]>([]);
  const [lastSggsMatchFound, setLastSggsMatchFound] = useState<boolean | null>(null);
  const [lastFallbackUsed, setLastFallbackUsed] = useState<boolean | null>(null);
  const [lastBestSggsMatch, setLastBestSggsMatch] = useState<string | null>(null);
  const [lastBestSggsScore, setLastBestSggsScore] = useState<number | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentTextRef = useRef<string>('');
  const shabadsBeingFetched = useRef<Set<number>>(new Set());

  // Debounced function to send transcription data
  const debouncedSendTranscription = useCallback((text: string, confidence: number) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Don't send if it's the same as last sent text
    if (text === lastSentTextRef.current) {
      return;
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      if (shabads.length > 0 || searchTriggered) return;
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        const transcriptionData: TranscriptionData = {
          text: text,
          confidence: confidence
        };
        websocketRef.current.send(JSON.stringify(transcriptionData));
        lastSentTextRef.current = text;
      }
    }, 300); // 300ms debounce delay
  }, [shabads, searchTriggered]);

  // Fix: Clear debounce timer when fullShabad is set
  useEffect(() => {
    if (shabads.length > 0 && debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, [shabads]);

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      
      const ws = new WebSocket('ws://localhost:8000/ws/transcription');
      
      ws.onopen = () => {
        setConnectionStatus('connected');
        setError('');
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'search_result') {
            setSearchResults(data.results);
            setSggsMatchFound(data.sggs_match_found ?? null);
            setFallbackUsed(data.fallback_used ?? null);
            setBestSggsMatch(data.best_sggs_match ?? null);
            setBestSggsScore(data.best_sggs_score ?? null);
            // Only update last* states if results are present (i.e., a search actually happened)
            if (data.results && data.results.length > 0) {
              setLastSearchQuery(data.transcribed_text);
              setLastSearchResults(data.results);
              setLastSggsMatchFound(data.sggs_match_found ?? null);
              setLastFallbackUsed(data.fallback_used ?? null);
              setLastBestSggsMatch(data.best_sggs_match ?? null);
              setLastBestSggsScore(data.best_sggs_score ?? null);
            }
            // Only fetch full shabad if not already loaded
            if (data.results && data.results.length > 0 && data.results[0].shabad_id) {
              const newShabadId = data.results[0].shabad_id;
              if (!shabads.some(s => s.shabad_id === newShabadId) && !shabadsBeingFetched.current.has(newShabadId)) {
                shabadsBeingFetched.current.add(newShabadId);
                fetch(`/api/full-shabad?shabadId=${newShabadId}`)
                  .then(res => res.json())
                  .then(data => {
                    setShabads(prev => [...prev, data]);
                  })
                  .finally(() => {
                    shabadsBeingFetched.current.delete(newShabadId);
                  });
              }
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      ws.onclose = () => {
        setConnectionStatus('disconnected');
        console.log('WebSocket disconnected');
      };
      
      ws.onerror = (error) => {
        setConnectionStatus('disconnected');
        setError('WebSocket connection failed');
        console.error('WebSocket error:', error);
      };
      
      websocketRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      // Clean up previous recognition instance only on unmount
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pa-IN'; // Punjabi (India)
      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };
      recognition.onresult = (event) => {
        let newTranscript = '';
        let interim = '';
        let maxConfidence = 0;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          if (event.results[i].isFinal) {
            newTranscript += transcript;
            maxConfidence = Math.max(maxConfidence, confidence);
          } else {
            interim += transcript;
          }
        }
        setTranscribedText(prev => {
          const updated = prev + newTranscript;
          const fullTranscript = (updated + interim).trim();
          const wordCount = fullTranscript.split(/\s+/).length;
          
          // Backend: Only send when word count >= 8, and send the full transcription
          if (wordCount >= 8) {
            debouncedSendTranscription(fullTranscript, maxConfidence);
          }
          return updated;
        });
        setInterimTranscript(interim);
      };
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        // Only show error if it's not an intentional abort
        if (event.error !== 'aborted') {
          setError(`Speech recognition error: ${event.error}`);
        } else {
          setError(''); // Clear error for abort
        }
        setIsListening(false);
      };
      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    } else {
      setError('Speech recognition not supported in this browser');
    }
    // Cleanup only on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []); // Only run once on mount/unmount

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError('Failed to start speech recognition');
      }
    }
  };

  const pauseListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort(); // Use abort to forcefully stop and release mic
    }
    setIsListening(false);
  };

  const stopListeningAndClear = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort(); // Use abort to forcefully stop and release mic
    }
    setIsListening(false);
    setTranscribedText('');
    setInterimTranscript('');
    setSearchResults([]);
    setShabads([]); // Allow new searches
    setSearchTriggered(false);
  };

  // Callback to fetch next shabad
  const handleNeedNextShabad = () => {
    const lastShabad = shabads[shabads.length - 1];
    const nextShabadId = lastShabad?.navigation?.next;
    if (
      nextShabadId &&
      !shabads.some(s => s.shabad_id === nextShabadId) &&
      !shabadsBeingFetched.current.has(nextShabadId)
    ) {
      shabadsBeingFetched.current.add(nextShabadId);
      fetch(`/api/full-shabad?shabadId=${nextShabadId}`)
        .then(res => res.json())
        .then(data => {
          setShabads(prev => [...prev, data]);
        })
        .finally(() => {
          shabadsBeingFetched.current.delete(nextShabadId);
        });
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>ੴ Bani AI</h1>
        <p>Real-time Punjabi Audio Transcription & BaniDB Search</p>
        
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatus}`}>
            {connectionStatus === 'connected' ? '🟢' : 
             connectionStatus === 'connecting' ? '🟡' : '🔴'}
          </span>
          <span className="status-text">
            {connectionStatus === 'connected' ? 'Connected to BaniDB API' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </header>

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
        <div className="controls">
          <div className="control-group">
            <button 
              className={`listen-button ${isListening ? 'listening' : ''}`}
              onClick={isListening ? pauseListening : startListening}
              disabled={connectionStatus !== 'connected'}
            >
              {isListening ? '⏸️ Pause Listening' : '🎤 Start Listening'}
            </button>
          </div>
          
          <button 
            className="clear-button"
            onClick={stopListeningAndClear}
            disabled={!transcribedText && searchResults.length === 0}
          >
            🗑️ Clear
          </button>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="content-grid">
          <div className="left-panel">
            <TranscriptionPanel 
              transcribedText={transcribedText + interimTranscript}
              isListening={isListening}
            />
            <AudioVisualizer isListening={isListening} />
          </div>
          
          <div className="right-panel">
            <SearchResults 
              results={lastSearchResults}
              transcribedText={lastSearchQuery}
              sggsMatchFound={lastSggsMatchFound}
              fallbackUsed={lastFallbackUsed}
              bestSggsMatch={lastBestSggsMatch}
              bestSggsScore={lastBestSggsScore}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 