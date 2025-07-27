/**
 * SGGS Data Service
 * Handles SGGS text loading, processing, and fuzzy search functionality
 * Ported from Python backend main.py functionality
 */

import { 
  SGGSIndex, 
  SGGSLineMap, 
  FuzzyMatch, 
  ServiceResponse, 
  ApiError, 
  ErrorType,
  CacheEntry
} from '../types/SearchTypes';
import { 
  normalizeUnicode, 
  stripGurmukhiMatras, 
  getFirstLettersSearch,
  cleanLine 
} from '../utils/TextProcessingUtils';
import { 
  fuzzySearchSGGS, 
  getBestFuzzyMatch, 
  createFuzzySearcher 
} from '../utils/FuzzySearchUtils';
import { RetryUtils } from '../utils/RetryUtils';

// Configuration constants
const SGGS_DATA_PATH = '/data/SGGS.txt';
const SGGS_INDEX_PATH = '/data/sggs_inverted_index.json';
const SGGS_LINE_MAP_PATH = '/data/sggs_line_map.json';
const DEFAULT_FUZZY_THRESHOLD = 40;
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Cache for SGGS data and search results
interface SGGSCache {
  lines: string[] | null;
  index: SGGSIndex | null;
  lineMap: SGGSLineMap | null;
  searchResults: { [key: string]: CacheEntry<FuzzyMatch[]> };
  lastLoaded: number;
}

class SGGSService {
  private cache: SGGSCache = {
    lines: null,
    index: null,
    lineMap: null,
    searchResults: {},
    lastLoaded: 0
  };
  
  private fuzzySearcher: any = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Initialize the SGGS service and load data
   */
  async initialize(): Promise<ServiceResponse<boolean>> {
    try {
      await this.loadSGGSData();
      return { success: true, data: true };
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.DATA_LOADING_ERROR,
        message: `Failed to initialize SGGS service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error
      };
      return { success: false, error: apiError };
    }
  }

  /**
   * Load SGGS text data from public/data directory
   */
  private async loadSGGSData(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    // Check if data is already loaded and fresh
    const now = Date.now();
    if (this.cache.lines && (now - this.cache.lastLoaded) < CACHE_EXPIRY_MS) {
      console.log('SGGS data already loaded and fresh');
      return;
    }

    this.isLoading = true;
    this.loadPromise = this._performDataLoad();
    
    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  /**
   * Perform the actual data loading
   */
  private async _performDataLoad(): Promise<void> {
    try {
      console.log('Loading SGGS data from public/data directory...');
      
      // Load SGGS text lines
      const response = await fetch(SGGS_DATA_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load SGGS.txt: ${response.status} ${response.statusText}`);
      }
      
      const text = await response.text();
      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => normalizeUnicode(line, 'NFC') || line); // Fallback to original line if normalize fails
      
      if (lines.length === 0) {
        throw new Error('SGGS.txt appears to be empty or invalid');
      }
      
      this.cache.lines = lines;
      this.cache.lastLoaded = Date.now();
      
      // Create fuzzy searcher instance
      this.fuzzySearcher = createFuzzySearcher(lines, { 
        threshold: DEFAULT_FUZZY_THRESHOLD 
      });
      
      console.log(`Successfully loaded ${lines.length} lines from SGGS.txt`);
      
      // Optionally load index and line map (for future use)
      await this.loadOptionalIndexData();
      
    } catch (error) {
      console.error('Error loading SGGS data:', error);
      throw error;
    }
  }

  /**
   * Load optional index and line map data
   */
  private async loadOptionalIndexData(): Promise<void> {
    try {
      // Load inverted index
      const indexResponse = await fetch(SGGS_INDEX_PATH);
      if (indexResponse.ok) {
        this.cache.index = await indexResponse.json();
        console.log('Successfully loaded SGGS inverted index');
      } else {
        console.warn('SGGS inverted index not available, will skip index-based search');
      }
      
      // Load line map
      const lineMapResponse = await fetch(SGGS_LINE_MAP_PATH);
      if (lineMapResponse.ok) {
        this.cache.lineMap = await lineMapResponse.json();
        console.log('Successfully loaded SGGS line map');
      } else {
        console.warn('SGGS line map not available, will use direct line access');
      }
    } catch (error) {
      console.warn('Error loading optional SGGS index data:', error);
      // Don't throw - these are optional files
    }
  }

  /**
   * Perform fuzzy search on SGGS text
   * Ported from Python fuzzy_search_sggs function
   */
  async fuzzySearch(
    query: string, 
    threshold: number = DEFAULT_FUZZY_THRESHOLD
  ): Promise<ServiceResponse<FuzzyMatch[]>> {
    try {
      console.log(`DEBUG: SGGS fuzzy search - query='${query}', threshold=${threshold}`);
      
      if (!query.trim()) {
        console.log("DEBUG: Empty query provided");
        return { success: true, data: [] };
      }
      
      // Ensure data is loaded
      await this.loadSGGSData();
      
      if (!this.cache.lines || this.cache.lines.length === 0) {
        throw new Error('SGGS data not loaded or empty');
      }
      
      // Check cache first
      const cacheKey = `${query.trim()}_${threshold}`;
      const cachedResult = this.cache.searchResults[cacheKey];
      const now = Date.now();
      
      if (cachedResult && (now - cachedResult.timestamp) < CACHE_EXPIRY_MS) {
        console.log(`Cache hit for fuzzy search: '${query}'`);
        return { success: true, data: cachedResult.data };
      }
      
      // Perform fuzzy search
      const matches = this.fuzzySearcher 
        ? this.fuzzySearcher.search(query)
        : fuzzySearchSGGS(query, this.cache.lines, { threshold, maxResults: 10 });
      
      console.log(`DEBUG: Fuzzy search returned ${matches.length} matches`);
      
      if (matches.length > 0) {
        const bestMatch = matches[0];
        console.log(`DEBUG: Best match - Score=${bestMatch.score}, Text='${bestMatch.text}'`);
      }
      
      // Cache the results
      this.cache.searchResults[cacheKey] = {
        data: matches,
        timestamp: now,
        expiry: now + CACHE_EXPIRY_MS
      };
      
      return { success: true, data: matches };
      
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.SEARCH_ERROR,
        message: `Fuzzy search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: { query, threshold, error }
      };
      return { success: false, error: apiError };
    }
  }

  /**
   * Get the best fuzzy match for a query
   * Simplified version that returns only the top match
   */
  async getBestMatch(
    query: string, 
    threshold: number = DEFAULT_FUZZY_THRESHOLD
  ): Promise<ServiceResponse<FuzzyMatch | null>> {
    try {
      const searchResult = await this.fuzzySearch(query, threshold);
      
      if (!searchResult.success) {
        return { success: false, error: searchResult.error };
      }
      
      const matches = searchResult.data || [];
      const bestMatch = matches.length > 0 ? matches[0] : null;
      
      return { success: true, data: bestMatch };
      
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.SEARCH_ERROR,
        message: `Get best match failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: { query, threshold, error }
      };
      return { success: false, error: apiError };
    }
  }

  /**
   * Process SGGS line for search (strip matras, clean, etc.)
   * Ported from Python line processing logic
   */
  processLineForSearch(line: string): { stripped: string; firstLetters: string; cleaned: string } {
    if (!line) {
      return { stripped: '', firstLetters: '', cleaned: '' };
    }
    
    // Normalize the line
    const normalized = normalizeUnicode(line, 'NFC') || line;
    
    // Clean the line (remove SGGS markers)
    let cleaned = normalized;
    if (cleaned && cleaned.includes('॥')) {
      cleaned = cleaned.split('॥')[0].trim();
    }
    cleaned = cleanLine(cleaned) || '';
    
    // Strip matras for search
    const stripped = stripGurmukhiMatras(cleaned) || '';
    
    // Get first letters for searchtype=1
    const firstLetters = getFirstLettersSearch(cleaned) || '';
    
    return { stripped, firstLetters, cleaned };
  }

  /**
   * Get SGGS lines (for external use)
   */
  async getLines(): Promise<ServiceResponse<string[]>> {
    try {
      await this.loadSGGSData();
      
      if (!this.cache.lines) {
        throw new Error('SGGS lines not available');
      }
      
      return { success: true, data: [...this.cache.lines] };
      
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.DATA_LOADING_ERROR,
        message: `Failed to get SGGS lines: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error
      };
      return { success: false, error: apiError };
    }
  }

  /**
   * Get SGGS index (if available)
   */
  async getIndex(): Promise<ServiceResponse<SGGSIndex | null>> {
    try {
      await this.loadSGGSData();
      return { success: true, data: this.cache.index };
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.DATA_LOADING_ERROR,
        message: `Failed to get SGGS index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error
      };
      return { success: false, error: apiError };
    }
  }

  /**
   * Get SGGS line map (if available)
   */
  async getLineMap(): Promise<ServiceResponse<SGGSLineMap | null>> {
    try {
      await this.loadSGGSData();
      return { success: true, data: this.cache.lineMap };
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.DATA_LOADING_ERROR,
        message: `Failed to get SGGS line map: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error
      };
      return { success: false, error: apiError };
    }
  }

  /**
   * Check if SGGS data is loaded
   */
  isDataLoaded(): boolean {
    return this.cache.lines !== null && this.cache.lines.length > 0;
  }

  /**
   * Get data loading status
   */
  getLoadingStatus(): { isLoading: boolean; isLoaded: boolean; lineCount: number } {
    return {
      isLoading: this.isLoading,
      isLoaded: this.isDataLoaded(),
      lineCount: this.cache.lines?.length || 0
    };
  }

  /**
   * Clear cache and reload data
   */
  async reload(): Promise<ServiceResponse<boolean>> {
    try {
      // Clear cache
      this.cache = {
        lines: null,
        index: null,
        lineMap: null,
        searchResults: {},
        lastLoaded: 0
      };
      this.fuzzySearcher = null;
      
      // Reload data
      await this.loadSGGSData();
      
      return { success: true, data: true };
    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.DATA_LOADING_ERROR,
        message: `Failed to reload SGGS data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error
      };
      return { success: false, error: apiError };
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    const oldKeys = Object.keys(this.cache.searchResults).filter(key => {
      const entry = this.cache.searchResults[key];
      return now > entry.expiry;
    });
    
    for (const key of oldKeys) {
      delete this.cache.searchResults[key];
    }
    
    if (oldKeys.length > 0) {
      console.log(`Cleaned up ${oldKeys.length} old SGGS search cache entries`);
    }
  }

  /**
   * Reset the service (for testing purposes)
   */
  reset(): void {
    this.cache = {
      lines: null,
      index: null,
      lineMap: null,
      searchResults: {},
      lastLoaded: 0
    };
    this.fuzzySearcher = null;
    this.isLoading = false;
    this.loadPromise = null;
  }
}

// Create and export singleton instance
const sggsService = new SGGSService();

export default sggsService;
export { SGGSService };