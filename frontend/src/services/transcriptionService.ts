// Transcription service for REST API communication

// Import BaniDB types from the service
import { BaniDBSearchResult, banidbService } from './banidbService';

export interface TranscriptionRequest {
  text: string;
  confidence: number;
  session_id?: string;
}

export interface TranscriptionResponse {
  transcribed_text: string;
  confidence: number;
  sggs_match_found: boolean;
  best_sggs_match: string | null;
  best_sggs_score: number | null;
  timestamp: number;
}

export interface SearchResult {
  gurmukhi_text: string;
  english_translation: string;
  verse_id: number;
  shabad_id: number;
  source: string;
  writer: string;
  raag: string;
}

export interface FullTranscriptionResponse extends TranscriptionResponse {
  results: SearchResult[];
}

class TranscriptionService {
  private baseUrl: string;
  private sessionId: string;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'https://bani-ai.onrender.com';
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  async transcribeAndSearch(text: string, confidence: number): Promise<FullTranscriptionResponse> {
    const request: TranscriptionRequest = {
      text,
      confidence,
      session_id: this.sessionId
    };

    try {
      // Step 1: Get SGGS fuzzy match from backend
      const response = await fetch(`${this.baseUrl}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const backendData: TranscriptionResponse = await response.json();

      // Step 2: Only search BaniDB if we have a good SGGS match
      let results: SearchResult[] = [];

      if (backendData.sggs_match_found && backendData.best_sggs_match) {
        console.log(`Using SGGS match: ${backendData.best_sggs_match}`);
        const banidbResults = await banidbService.searchFromSGGSLine(backendData.best_sggs_match);
        results = banidbResults.map(this.mapBaniDBResult);
      } else {
        console.log(`No good SGGS match found - no BaniDB search performed`);
      }

      // If no results found, refresh the page
      if (results.length === 0) {
        console.log('No transcription results found, refreshing page...');
        setTimeout(() => {
          window.location.reload();
        }, 1000); // Small delay to show any loading state
        throw new Error('No results found - page will refresh');
      }

      return {
        ...backendData,
        results
      };
    } catch (error) {
      console.error('Transcription service error:', error);
      throw error;
    }
  }

  private mapBaniDBResult(banidbResult: BaniDBSearchResult): SearchResult {
    return {
      gurmukhi_text: banidbResult.gurmukhi_text,
      english_translation: banidbResult.english_translation,
      verse_id: banidbResult.verse_id,
      shabad_id: banidbResult.shabad_id,
      source: banidbResult.source,
      writer: banidbResult.writer,
      raag: banidbResult.raag
    };
  }



  getSessionId(): string {
    return this.sessionId;
  }

  resetSession(): void {
    this.sessionId = this.generateSessionId();
  }
}

// Export singleton instance
export const transcriptionService = new TranscriptionService();