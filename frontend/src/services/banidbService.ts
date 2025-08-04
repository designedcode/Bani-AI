// Direct BaniDB API service for frontend
// Handles full shabad fetching and search without going through our backend

import { stripGurmukhiMatras, getFirstLettersSearch } from './gurmukhiUtils';

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

export interface BaniDBSearchResult {
  gurmukhi_text: string;
  english_translation: string;
  verse_id: number;
  shabad_id: number;
  source: string;
  writer: string;
  raag: string;
}

class BaniDBService {
  private baseUrl: string;
  private searchCache: Map<string, BaniDBSearchResult[]> = new Map();

  constructor() {
    this.baseUrl = process.env.REACT_APP_BANIDB_API_URL || 'https://api.banidb.com/v2';
  }

  async searchBaniDB(query: string, source: string = "all", searchtype: string = "6"): Promise<BaniDBSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const searchQuery = query.trim();
    console.log(`BaniDB search: Original query: '${query}' -> Using as is for search`);

    // Check cache first
    const cacheKey = `${searchQuery}_${source}_${searchtype}`;
    if (this.searchCache.has(cacheKey)) {
      console.log(`Cache hit for query: '${searchQuery}'`);
      return this.searchCache.get(cacheKey)!;
    }

    try {
      const searchUrl = `${this.baseUrl}/search/${encodeURIComponent(searchQuery)}`;
      const params = new URLSearchParams({
        source,
        searchtype,
        writer: "all",
        page: "1",
        livesearch: "1"
      });

      const response = await fetch(`${searchUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const results: BaniDBSearchResult[] = [];

      // The API returns "verses" not "results"
      if (data.verses) {
        for (const verse of data.verses.slice(0, 10)) { // Limit to 10 results
          results.push({
            gurmukhi_text: verse.verse?.unicode || "",
            english_translation: verse.translation?.en?.bdb || "",
            verse_id: verse.verseId || 0,
            shabad_id: verse.shabadId || 0,
            source: "", // Default source
            writer: "", // Default writer
            raag: "" // Will be populated if available
          });
        }
      }

      // Cache the results
      this.searchCache.set(cacheKey, results);
      console.log(`BaniDB search returned ${results.length} results for query: '${searchQuery}'`);
      return results;

    } catch (error) {
      console.error('BaniDB API search error:', error);
      return [];
    }
  }

  async searchFromSGGSLine(sggsLine: string): Promise<{ results: BaniDBSearchResult[], fallbackUsed: boolean }> {
    if (!sggsLine) {
      return { results: [], fallbackUsed: false };
    }

    // Process the SGGS line
    let verse = sggsLine;
    if (verse.includes('॥')) {
      verse = verse.split('॥')[0].trim();
    }
    verse = verse.normalize('NFC');

    console.log(`Original SGGS line for BaniDB search: '${verse}'`);

    // PRIMARY: Try direct search with searchtype=2 (exact line match)
    console.log(`Trying searchtype=2 with exact SGGS line: '${verse}'`);
    let results = await this.searchBaniDB(verse, "all", "2");

    if (results.length > 0) {
      console.log(`Found ${results.length} results with searchtype=2`);
      return { results, fallbackUsed: false };
    }

    // FALLBACK 1: Try with stripped matras and searchtype=6 (exact match)
    const strippedVerse = stripGurmukhiMatras(verse);
    console.log(`No results with searchtype=2, trying searchtype=6 with stripped verse: '${strippedVerse}'`);
    results = await this.searchBaniDB(strippedVerse, "all", "6");

    if (results.length > 0) {
      console.log(`Found ${results.length} results with searchtype=6`);
      return { results, fallbackUsed: true };
    }

    // FALLBACK 2: Try first letter search with searchtype=1
    console.log(`No results with searchtype=6, falling back to first letter search`);
    const fallbackFirstLetters = getFirstLettersSearch(verse);
    console.log(`Fallback first letters: '${fallbackFirstLetters}'`);

    const fallbackResults = await this.searchBaniDB(fallbackFirstLetters, "all", "1");
    console.log(`Found ${fallbackResults.length} results with searchtype=1`);
    return { results: fallbackResults, fallbackUsed: true };
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