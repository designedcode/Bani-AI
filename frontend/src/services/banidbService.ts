// Direct BaniDB API service for frontend
// Handles full shabad fetching without going through our backend

export interface BaniDBShabadResponse {
  shabad_id: number;
  shabad_name?: string;
  page_no?: number;
  source?: string;
  raag?: string;
  writer?: string;
  count?: number;
  navigation?: {
    previous?: number;
    next?: number;
  };
  lines_highlighted: Array<{
    gurmukhi_highlighted: string;
    gurmukhi_original: string;
    transliteration: string;
    translation: string;
    page_no?: number;
    line_no?: number;
    verse_id?: number;
  }>;
}

class BaniDBService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.REACT_APP_BANIDB_API_URL || 'https://api.banidb.com/v2';
  }

  async getFullShabad(shabadId: number, verseId?: number): Promise<BaniDBShabadResponse> {
    try {
      // Try fetching full shabad from BaniDB (use plural 'shabads')
      const shabadUrl = `${this.baseUrl}/shabads/${shabadId}`;
      let response: Response;
      let shabadData: any;

      try {
        response = await fetch(shabadUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        shabadData = await response.json();
      } catch (error: any) {
        if (error.message.includes('404') && verseId) {
          // Fallback: fetch by verse
          const verseUrl = `${this.baseUrl}/verse/${verseId}`;
          response = await fetch(verseUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          shabadData = await response.json();
        } else {
          throw error;
        }
      }

      // Map shabadInfo fields to top-level fields (same logic as backend)
      const info = shabadData.shabadInfo || {};
      const mapped: BaniDBShabadResponse = {
        shabad_id: info.shabadId,
        shabad_name: info.shabadName,
        page_no: info.pageNo,
        source: info.source?.unicode,
        raag: info.raag?.unicode,
        writer: info.writer?.english,
        count: shabadData.count,
        navigation: shabadData.navigation,
        lines_highlighted: []
      };

      // Map verses to lines_highlighted
      mapped.lines_highlighted = (shabadData.verses || []).map((v: any) => ({
        gurmukhi_highlighted: v.verse?.unicode || v.verse?.gurmukhi || "",
        gurmukhi_original: v.verse?.unicode || v.verse?.gurmukhi || "",
        transliteration: v.transliteration?.english || "",
        translation: v.translation?.en?.bdb || "",
        page_no: v.pageNo,
        line_no: v.lineNo,
        verse_id: v.verseId,
      }));

      return mapped;
    } catch (error) {
      console.error('BaniDB API error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const banidbService = new BaniDBService();