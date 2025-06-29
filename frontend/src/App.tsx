import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import TranscriptionPanel from './components/TranscriptionPanel';
import SearchResults from './components/SearchResults';
import AudioVisualizer from './components/AudioVisualizer';
import FileUpload from './components/FileUpload';

interface SearchResult {
  gurmukhi_text: string;
  english_translation: string;
  line_number: number;
  page_number: number;
  source?: string;
  writer?: string;
  raag?: string;
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string>('');
  
  const websocketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
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
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            
            // Send to WebSocket for processing
            if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
              const transcriptionData: TranscriptionData = {
                text: transcript,
                confidence: confidence
              };
              websocketRef.current.send(JSON.stringify(transcriptionData));
            }
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscribedText(finalTranscript + interimTranscript);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
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
  }, []);

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

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const clearText = () => {
    setTranscribedText('');
    setSearchResults([]);
    setUploadedFile('');
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      setUploadedFile(file.name);
      
      // For MVP, we'll use a placeholder transcription
      // In production, this would be the actual transcription from the service
      const placeholderText = "ਜਪੁਜੀ ਸਾਹਿਬ ਗੁਰ ਪਰਸਾਦੀ";
      setTranscribedText(placeholderText);
      
      // Search BaniDB with the transcribed text
      const searchResponse = await fetch(`/api/search?query=${encodeURIComponent(placeholderText)}`);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        setSearchResults(searchData.results);
      }
      
    } catch (err) {
      setError(`Upload error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🕉️ Bani AI</h1>
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
        <div className="controls">
          <div className="control-group">
            <button 
              className={`listen-button ${isListening ? 'listening' : ''}`}
              onClick={isListening ? stopListening : startListening}
              disabled={connectionStatus !== 'connected'}
            >
              {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
            </button>
            
            <FileUpload 
              onFileUpload={handleFileUpload}
              isUploading={isUploading}
              disabled={connectionStatus !== 'connected'}
            />
          </div>
          
          <button 
            className="clear-button"
            onClick={clearText}
            disabled={!transcribedText && searchResults.length === 0 && !uploadedFile}
          >
            🗑️ Clear
          </button>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {uploadedFile && (
          <div className="upload-info">
            📁 Uploaded: {uploadedFile}
          </div>
        )}

        <div className="content-grid">
          <div className="left-panel">
            <TranscriptionPanel 
              transcribedText={transcribedText}
              isListening={isListening}
            />
            <AudioVisualizer isListening={isListening} />
          </div>
          
          <div className="right-panel">
            <SearchResults 
              results={searchResults}
              transcribedText={transcribedText}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 