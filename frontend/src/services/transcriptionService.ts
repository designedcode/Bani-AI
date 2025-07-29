// Transcription service for REST API communication

export interface TranscriptionRequest {
  text: string;
  confidence: number;
  session_id?: string;
}

export interface TranscriptionResponse {
  transcribed_text: string;
  confidence: number;
  results: SearchResult[];
  sggs_match_found: boolean;
  fallback_used: boolean;
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

class TranscriptionService {
  private baseUrl: string;
  private sessionId: string;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async transcribeAndSearch(text: string, confidence: number): Promise<TranscriptionResponse> {
    const request: TranscriptionRequest = {
      text,
      confidence,
      session_id: this.sessionId
    };

    try {
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

      const data: TranscriptionResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Transcription service error:', error);
      throw error;
    }
  }

  async getFullShabad(shabadId: number, verseId?: number, transcription?: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        shabadId: shabadId.toString(),
        ...(verseId && { verseId: verseId.toString() }),
        ...(transcription && { transcription })
      });

      const response = await fetch(`${this.baseUrl}/api/full-shabad?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Full shabad fetch error:', error);
      throw error;
    }
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