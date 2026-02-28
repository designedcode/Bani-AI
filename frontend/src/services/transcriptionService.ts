// Transcription service for REST API communication

export interface TranscriptionRequest {
  text: string;
  confidence: number;
  session_id?: string;
}

export interface TranscriptionResponse {
  transcribed_text: string;
  confidence: number;
  sggs_match_found: boolean;
  shabad_id: number;
  best_sggs_match: string;
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
    this.baseUrl =
      process.env.REACT_APP_API_URL || "https://bani-ai.onrender.com";
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  async transcribeAndSearch(
    text: string,
    confidence: number
  ): Promise<FullTranscriptionResponse> {

    console.log("🎤 Sending to backend:", text);

    const request: TranscriptionRequest = {
      text,
      confidence,
      session_id: this.sessionId,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const backendData: TranscriptionResponse = await response.json();

      console.log("📥 Backend Shabad ID:", backendData.shabad_id);

      let results: SearchResult[] = [];

      if (backendData.sggs_match_found && backendData.shabad_id) {
        results = [
          {
            gurmukhi_text: backendData.best_sggs_match,
            english_translation: "",
            verse_id: 0,
            shabad_id: backendData.shabad_id,
            source: "",
            writer: "",
            raag: "",
          },
        ];
      }

      return {
        ...backendData,
        results,
      };

    } catch (error) {
      console.error("❌ Transcription service error:", error);
      throw error;
    }
  }

  resetSession(): void {
    console.log("🔄 Resetting Session");
    this.sessionId = this.generateSessionId();
  }
}

export const transcriptionService = new TranscriptionService();