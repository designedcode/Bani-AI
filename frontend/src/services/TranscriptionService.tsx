/**
 * Transcription Service
 * Handles real-time transcription processing and WebSocket communication
 * Ported from Python backend WebSocket endpoint functionality
 */

import {
  TranscriptionData,
  SearchResult,
  SearchResultMessage,
  TranscriptionMessage,
  WebSocketMessage,
  ServiceResponse,
  ApiError,
  ErrorType,
  ConnectionState,
  SearchType,
  SourceType
} from '../types/SearchTypes';
import { BaniDBService } from './BaniDBService';
import { SGGSService } from './SGGSService';
import { stripGurmukhiMatras, getFirstLettersSearch } from '../utils/TextProcessingUtils';

// Configuration constants
const DEBOUNCE_DELAY = 500; // 500ms debounce delay
const FUZZY_THRESHOLD = parseFloat(process.env.REACT_APP_FUZZY_MATCH_THRESHOLD || '40');
const RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_ATTEMPTS = 5;

// WebSocket message handlers
type MessageHandler = (message: SearchResultMessage) => void;
type ErrorHandler = (error: ApiError) => void;
type ConnectionHandler = (connected: boolean) => void;

class TranscriptionService {
  private websocket: WebSocket | null = null;
  private connectionState: ConnectionState = {
    connected: false,
    topResultFound: false,
    lastSearchTime: 0
  };
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // Service dependencies
  private baniDBService: BaniDBService;
  private sggsService: SGGSService;
  
  // Event handlers
  private messageHandlers: MessageHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  
  // Debounced search function
  private debouncedSearch: ((text: string, confidence: number) => void) | null = null;

  constructor() {
    this.baniDBService = new BaniDBService();
    this.sggsService = new SGGSService();
    this.setupDebouncedSearch();
  }

  /**
   * Setup debounced search to avoid too many API calls
   */
  private setupDebouncedSearch(): void {
    this.debouncedSearch = this.debounce(
      async (text: string, confidence: number) => {
        await this.processTranscription(text, confidence);
      },
      DEBOUNCE_DELAY
    );
  }

  /**
   * Simple debounce implementation
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Connect to WebSocket (simulated - in real implementation this would connect to a WebSocket server)
   * For now, this sets up the service for direct transcription processing
   */
  public async connect(): Promise<ServiceResponse<boolean>> {
    try {
      // Reset connection state
      this.connectionState = {
        connected: true,
        topResultFound: false,
        lastSearchTime: 0
      };
      
      this.reconnectAttempts = 0;
      this.notifyConnectionHandlers(true);
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.WEBSOCKET_ERROR,
        message: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      
      this.notifyErrorHandlers(apiError);
      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.connectionState.connected = false;
    this.notifyConnectionHandlers(false);
  }

  /**
   * Process transcription text and search for matches
   * This is the main logic ported from the WebSocket endpoint
   */
  public async processTranscription(text: string, confidence: number): Promise<void> {
    if (!this.connectionState.connected) {
      const error: ApiError = {
        type: ErrorType.WEBSOCKET_ERROR,
        message: 'Service not connected',
        timestamp: Date.now()
      };
      this.notifyErrorHandlers(error);
      return;
    }

    // Skip if top result already found (matches backend logic)
    if (this.connectionState.topResultFound) {
      console.log('Top result already found. Skipping further searches.');
      return;
    }

    // Debouncing check
    const currentTime = Date.now();
    if (currentTime - this.connectionState.lastSearchTime < DEBOUNCE_DELAY) {
      console.log('Debouncing search');
      return;
    }
    
    this.connectionState.lastSearchTime = currentTime;

    try {
      console.log(`Processing transcription: ${text} (confidence: ${confidence})`);

      // Step 1: Fuzzy search SGGS.txt (ported from backend logic)
      const fuzzySearchResponse = await this.sggsService.fuzzySearch(text, FUZZY_THRESHOLD);
      
      let sggs_match_found = false;
      let fallback_used = false;
      let best_sggs_match: string | null = null;
      let best_sggs_score: number | null = null;
      let search_results: SearchResult[] = [];

      if (fuzzySearchResponse.success && fuzzySearchResponse.data && fuzzySearchResponse.data.length > 0) {
        const bestMatch = fuzzySearchResponse.data[0];
        best_sggs_match = bestMatch.text;
        best_sggs_score = bestMatch.score;
        
        console.log(`Best fuzzy match: Score=${bestMatch.score}, Line='${bestMatch.text}'`);
        
        if (bestMatch.score >= FUZZY_THRESHOLD) {
          sggs_match_found = true;
          
          // Process the matched line for BaniDB search
          let verse = bestMatch.text;
          if (verse.includes('॥')) {
            verse = verse.split('॥')[0].trim();
          }
          
          // Normalize and strip matras
          verse = verse.normalize('NFC');
          const strippedVerse = stripGurmukhiMatras(verse);
          
          console.log(`Stripped verse for BaniDB search: '${strippedVerse}' (from: '${verse}')`);
          
          // Try full text search first (searchtype=6)
          const searchResponse = await this.baniDBService.searchBaniDB(strippedVerse, SourceType.ALL, SearchType.FULL_TEXT);
          
          if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
            search_results = searchResponse.data;
            this.connectionState.topResultFound = true;
          } else {
            // Fallback to first letter search (searchtype=1)
            fallback_used = true;
            const fallbackFirstLetters = getFirstLettersSearch(verse);
            console.log(`Fallback first letters: '${fallbackFirstLetters}'`);
            
            const fallbackResponse = await this.baniDBService.searchBaniDB(
              fallbackFirstLetters, 
              SourceType.ALL, 
              SearchType.FIRST_LETTERS
            );
            
            if (fallbackResponse.success && fallbackResponse.data && fallbackResponse.data.length > 0) {
              search_results = fallbackResponse.data;
              this.connectionState.topResultFound = true;
            }
          }
        } else {
          console.log(`Best match below threshold (${FUZZY_THRESHOLD}). Using fallback.`);
          fallback_used = true;
          await this.performFallbackSearch(text);
        }
      } else {
        console.log('No fuzzy matches found. Using fallback.');
        fallback_used = true;
        search_results = await this.performFallbackSearch(text);
      }

      // Create response message (matches backend WebSocket response format)
      const response: SearchResultMessage = {
        type: 'search_result',
        transcribed_text: text,
        confidence: confidence,
        results: search_results,
        timestamp: currentTime,
        sggs_match_found,
        fallback_used,
        best_sggs_match,
        best_sggs_score
      };

      // Notify message handlers
      this.notifyMessageHandlers(response);

    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.TRANSCRIPTION_ERROR,
        message: `Transcription processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      
      this.notifyErrorHandlers(apiError);
    }
  }

  /**
   * Perform fallback search using first letters
   */
  private async performFallbackSearch(text: string): Promise<SearchResult[]> {
    const strippedText = stripGurmukhiMatras(text);
    const firstLetters = getFirstLettersSearch(text);
    
    console.log(`Fallback: Stripped='${strippedText}', First letters='${firstLetters}'`);
    
    const fallbackResponse = await this.baniDBService.searchBaniDB(
      firstLetters, 
      SourceType.ALL, 
      SearchType.FIRST_LETTERS
    );
    
    if (fallbackResponse.success && fallbackResponse.data && fallbackResponse.data.length > 0) {
      this.connectionState.topResultFound = true;
      return fallbackResponse.data;
    }
    
    return [];
  }

  /**
   * Send transcription data for processing
   */
  public async sendTranscription(text: string, confidence: number): Promise<void> {
    if (!this.debouncedSearch) {
      throw new Error('Debounced search not initialized');
    }
    
    this.debouncedSearch(text, confidence);
  }

  /**
   * Reset the top result found flag (useful for new transcription sessions)
   */
  public resetTopResultFound(): void {
    this.connectionState.topResultFound = false;
    console.log('Top result found flag reset');
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Add message handler
   */
  public onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Remove message handler
   */
  public removeMessageHandler(handler: MessageHandler): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index > -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * Add error handler
   */
  public onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Remove error handler
   */
  public removeErrorHandler(handler: ErrorHandler): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  /**
   * Add connection handler
   */
  public onConnection(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  /**
   * Remove connection handler
   */
  public removeConnectionHandler(handler: ConnectionHandler): void {
    const index = this.connectionHandlers.indexOf(handler);
    if (index > -1) {
      this.connectionHandlers.splice(index, 1);
    }
  }

  /**
   * Notify message handlers
   */
  private notifyMessageHandlers(message: SearchResultMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  /**
   * Notify error handlers
   */
  private notifyErrorHandlers(error: ApiError): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  /**
   * Notify connection handlers
   */
  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.disconnect();
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.connectionHandlers = [];
  }
}

export { TranscriptionService };