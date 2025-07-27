/**
 * BaniDB API Service
 * Handles BaniDB API integration for Gurbani text search
 * Ported from Python backend main.py functionality
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { debounce } from 'lodash';
import {
  SearchResult,
  BaniDBSearchResponse,
  BaniDBShabadResponse,
  BaniDBSourcesResponse,
  FullShabadData,
  ServiceResponse,
  ApiError,
  ErrorType,
  CacheEntry,
  SearchConfig,
  SearchType,
  SourceType
} from '../types/SearchTypes';
import { RetryUtils, DEFAULT_RETRY_CONFIG } from '../utils/RetryUtils';

// Configuration constants
const BANIDB_API_BASE_URL = 'https://api.banidb.com/v2';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const CONNECT_TIMEOUT = 5000; // 5 seconds
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 500; // 500ms debounce delay
const MAX_RESULTS = 10;

// Cache interfaces
interface SearchCache {
  [key: string]: CacheEntry<SearchResult[]>;
}

interface ShabadCache {
  [key: string]: CacheEntry<FullShabadData>;
}

interface SourcesCache {
  data: BaniDBSourcesResponse | null;
  timestamp: number;
  expiry: number;
}

class BaniDBService {
  private httpClient: AxiosInstance;
  private searchCache: SearchCache = {};
  private shabadCache: ShabadCache = {};
  private sourcesCache: SourcesCache = {
    data: null,
    timestamp: 0,
    expiry: 0
  };
  private lastSearchTime: { [query: string]: number } = {};

  constructor() {
    // Create axios instance with connection pooling and HTTP/2 support
    this.httpClient = axios.create({
      baseURL: BANIDB_API_BASE_URL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'BaniAI-Frontend/1.0.0'
      }
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        console.log(`BaniDB API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('BaniDB API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        console.log(`BaniDB API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        console.error('BaniDB API Response Error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Search BaniDB API for Gurbani text with caching and debouncing
   * Ported from Python search_banidb_api function
   */
  async searchBaniDB(
    query: string,
    source: string = SourceType.ALL,
    searchtype: string = SearchType.FULL_TEXT
  ): Promise<ServiceResponse<SearchResult[]>> {
    try {
      if (!query.trim()) {
        return { success: true, data: [] };
      }

      const searchQuery = query.trim();
      console.log(`Original query: '${query}' -> Using as is for BaniDB search`);

      // Check cache first
      const cacheKey = `${searchQuery}_${source}_${searchtype}`;
      const cachedResult = this.searchCache[cacheKey];
      const now = Date.now();

      if (cachedResult && (now - cachedResult.timestamp) < CACHE_EXPIRY_MS) {
        console.log(`Cache hit for query: '${searchQuery}'`);
        return { success: true, data: cachedResult.data };
      }

      // Debouncing: skip if too soon after last search
      const currentTime = Date.now();
      if (currentTime - (this.lastSearchTime[searchQuery] || 0) < DEBOUNCE_DELAY) {
        console.log(`Debouncing search for: '${searchQuery}'`);
        return { success: true, data: [] };
      }

      this.lastSearchTime[searchQuery] = currentTime;

      // Use retry mechanism for API call
      const retryResult = await RetryUtils.withRetry(async () => {
        // Prepare search parameters
        const searchUrl = `/search/${encodeURIComponent(searchQuery)}`;
        const params: SearchConfig = {
          source,
          searchtype,
          writer: 'all',
          page: '1',
          livesearch: '1'
        };

        // Make API request
        const response = await this.httpClient.get<BaniDBSearchResponse>(searchUrl, { params });
        return response.data;
      }, {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.API_ERROR]
      });

      if (!retryResult.success) {
        return { success: false, error: retryResult.error };
      }

      const data = retryResult.data!;
      const results: SearchResult[] = [];

      // Process API response - the API returns "verses" not "results"
      if (data.verses && Array.isArray(data.verses)) {
        for (const verse of data.verses.slice(0, MAX_RESULTS)) {
          results.push({
            gurmukhi_text: verse.verse?.unicode || verse.verse?.gurmukhi || '',
            english_translation: verse.translation?.en?.bdb || '',
            verse_id: verse.verseId || 0,
            shabad_id: verse.shabadId || 0,
            source: 'Guru Granth Sahib', // Default source
            writer: 'Guru Nanak Dev Ji', // Default writer
            raag: '' // Will be populated if available
          });
        }
      }

      // Cache the results
      this.searchCache[cacheKey] = {
        data: results,
        timestamp: now,
        expiry: now + CACHE_EXPIRY_MS
      };

      console.log(`BaniDB search returned ${results.length} results for query: '${searchQuery}' (${retryResult.attempts} attempts)`);
      return { success: true, data: results };

    } catch (error) {
      console.error('BaniDB API search error:', error);
      
      const apiError: ApiError = {
        type: this.getErrorType(error),
        message: this.getErrorMessage(error),
        code: this.getErrorCode(error),
        timestamp: Date.now(),
        details: { query, source, searchtype, error }
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Search with fallback mechanism
   * First tries full text search (searchtype=6), then falls back to first letters (searchtype=1)
   */
  async searchWithFallback(
    query: string,
    source: string = SourceType.ALL
  ): Promise<ServiceResponse<{ results: SearchResult[]; fallbackUsed: boolean }>> {
    try {
      // First try full text search
      const fullTextResult = await this.searchBaniDB(query, source, SearchType.FULL_TEXT);
      
      if (!fullTextResult.success) {
        return { success: false, error: fullTextResult.error };
      }

      if (fullTextResult.data && fullTextResult.data.length > 0) {
        return { 
          success: true, 
          data: { 
            results: fullTextResult.data, 
            fallbackUsed: false 
          } 
        };
      }

      // Fallback to first letters search
      console.log(`No results with searchtype=6, falling back to first letter search for: '${query}'`);
      const firstLettersResult = await this.searchBaniDB(query, source, SearchType.FIRST_LETTERS);
      
      if (!firstLettersResult.success) {
        return { success: false, error: firstLettersResult.error };
      }

      return { 
        success: true, 
        data: { 
          results: firstLettersResult.data || [], 
          fallbackUsed: true 
        } 
      };

    } catch (error) {
      const apiError: ApiError = {
        type: ErrorType.SEARCH_ERROR,
        message: `Search with fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: { query, source, error }
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Get full shabad by shabadId
   * Ported from Python get_full_shabad function
   */
  async getFullShabad(
    shabadId: number,
    verseId?: number,
    transcription?: string
  ): Promise<ServiceResponse<FullShabadData>> {
    try {
      // Check cache first
      const cacheKey = `shabad_${shabadId}_${verseId || 'none'}`;
      const cachedResult = this.shabadCache[cacheKey];
      const now = Date.now();

      if (cachedResult && (now - cachedResult.timestamp) < CACHE_EXPIRY_MS) {
        console.log(`Cache hit for shabad: ${shabadId}`);
        return { success: true, data: cachedResult.data };
      }

      // Use retry mechanism for API call
      const retryResult = await RetryUtils.withRetry(async () => {
        try {
          // Try fetching full shabad from BaniDB (use plural 'shabads')
          const shabadUrl = `/shabads/${shabadId}`;
          const response = await this.httpClient.get<BaniDBShabadResponse>(shabadUrl);
          return response.data;
        } catch (error) {
          // Fallback: fetch by verse if 404 and verseId is provided
          if (this.isNotFoundError(error) && verseId) {
            const verseUrl = `/verse/${verseId}`;
            const response = await this.httpClient.get<BaniDBShabadResponse>(verseUrl);
            return response.data;
          } else {
            throw error;
          }
        }
      }, {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.API_ERROR]
      });

      if (!retryResult.success) {
        return { success: false, error: retryResult.error };
      }

      const shabadData = retryResult.data!;

      // Map shabadInfo fields to top-level fields
      const info = shabadData.shabadInfo || {};
      const mapped: FullShabadData = {
        shabad_id: info.shabadId || shabadId,
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
      if (shabadData.verses && Array.isArray(shabadData.verses)) {
        mapped.lines_highlighted = shabadData.verses.map(verse => ({
          gurmukhi_highlighted: verse.verse?.unicode || verse.verse?.gurmukhi || '',
          gurmukhi_original: verse.verse?.unicode || verse.verse?.gurmukhi || '',
          transliteration: verse.transliteration?.english || '',
          translation: verse.translation?.en?.bdb || '',
          page_no: verse.pageNo,
          line_no: verse.lineNo,
          verse_id: verse.verseId || 0
        }));
      }

      // Cache the result
      this.shabadCache[cacheKey] = {
        data: mapped,
        timestamp: now,
        expiry: now + CACHE_EXPIRY_MS
      };

      console.log(`Fetched full shabad ${shabadId} (${retryResult.attempts} attempts)`);
      return { success: true, data: mapped };

    } catch (error) {
      console.error('Error fetching full shabad:', error);
      
      const apiError: ApiError = {
        type: this.getErrorType(error),
        message: `Failed to fetch full shabad: ${this.getErrorMessage(error)}`,
        code: this.getErrorCode(error),
        timestamp: Date.now(),
        details: { shabadId, verseId, transcription, error }
      };

      return { success: false, error: apiError };
    }
  }

  /**
   * Get available sources from BaniDB
   * Ported from Python get_sources function
   */
  async getSources(): Promise<ServiceResponse<BaniDBSourcesResponse>> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.sourcesCache.data && now < this.sourcesCache.expiry) {
        console.log('Cache hit for sources');
        return { success: true, data: this.sourcesCache.data };
      }

      // Use retry mechanism for API call
      const retryResult = await RetryUtils.withRetry(async () => {
        const response = await this.httpClient.get<BaniDBSourcesResponse>('/sources');
        return response.data;
      }, {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.API_ERROR]
      });

      if (!retryResult.success) {
        // Return default sources on error
        const defaultSources: BaniDBSourcesResponse = { sources: [] };
        return { success: false, error: retryResult.error, data: defaultSources };
      }

      const data = retryResult.data!;

      // Cache the result for longer (sources don't change often)
      this.sourcesCache = {
        data,
        timestamp: now,
        expiry: now + (60 * 60 * 1000) // 1 hour
      };

      console.log(`Fetched sources (${retryResult.attempts} attempts)`);
      return { success: true, data };

    } catch (error) {
      console.error('Error fetching sources:', error);
      
      const apiError: ApiError = {
        type: this.getErrorType(error),
        message: `Failed to fetch sources: ${this.getErrorMessage(error)}`,
        code: this.getErrorCode(error),
        timestamp: Date.now(),
        details: error
      };

      // Return default sources on error
      const defaultSources: BaniDBSourcesResponse = { sources: [] };
      return { success: false, error: apiError, data: defaultSources };
    }
  }

  /**
   * Create debounced search function
   */
  createDebouncedSearch = debounce(
    async (
      query: string,
      source: string,
      searchtype: string,
      callback: (result: ServiceResponse<SearchResult[]>) => void
    ) => {
      const result = await this.searchBaniDB(query, source, searchtype);
      callback(result);
    },
    DEBOUNCE_DELAY
  );

  /**
   * Clean up old cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    
    // Clean search cache
    const oldSearchKeys = Object.keys(this.searchCache).filter(key => {
      const entry = this.searchCache[key];
      return now > entry.expiry;
    });
    
    for (const key of oldSearchKeys) {
      delete this.searchCache[key];
    }

    // Clean shabad cache
    const oldShabadKeys = Object.keys(this.shabadCache).filter(key => {
      const entry = this.shabadCache[key];
      return now > entry.expiry;
    });
    
    for (const key of oldShabadKeys) {
      delete this.shabadCache[key];
    }

    // Clean sources cache
    if (now > this.sourcesCache.expiry) {
      this.sourcesCache = {
        data: null,
        timestamp: 0,
        expiry: 0
      };
    }

    const totalCleaned = oldSearchKeys.length + oldShabadKeys.length;
    if (totalCleaned > 0) {
      console.log(`Cleaned up ${totalCleaned} old BaniDB cache entries`);
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.searchCache = {};
    this.shabadCache = {};
    this.sourcesCache = {
      data: null,
      timestamp: 0,
      expiry: 0
    };
    this.lastSearchTime = {};
    console.log('BaniDB cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    searchCacheSize: number;
    shabadCacheSize: number;
    sourcesCache: boolean;
    lastSearchTimes: number;
  } {
    return {
      searchCacheSize: Object.keys(this.searchCache).length,
      shabadCacheSize: Object.keys(this.shabadCache).length,
      sourcesCache: this.sourcesCache.data !== null,
      lastSearchTimes: Object.keys(this.lastSearchTime).length
    };
  }

  /**
   * Helper method to determine error type from axios error
   */
  private getErrorType(error: any): ErrorType {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return ErrorType.NETWORK_ERROR;
      }
      if (error.response) {
        return ErrorType.API_ERROR;
      }
      return ErrorType.NETWORK_ERROR;
    }
    return ErrorType.API_ERROR;
  }

  /**
   * Helper method to get error message
   */
  private getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return `API Error: ${error.response.status} ${error.response.statusText}`;
      }
      if (error.request) {
        return `Network Error: ${error.message}`;
      }
    }
    return error instanceof Error ? error.message : 'Unknown error';
  }

  /**
   * Helper method to get error code
   */
  private getErrorCode(error: any): string | number | undefined {
    if (axios.isAxiosError(error)) {
      return error.response?.status || error.code;
    }
    return undefined;
  }

  /**
   * Helper method to check if error is 404 Not Found
   */
  private isNotFoundError(error: any): boolean {
    return axios.isAxiosError(error) && error.response?.status === 404;
  }

  /**
   * Reset the service (for testing purposes)
   */
  reset(): void {
    this.clearCache();
    // Reset axios instance if needed
    this.httpClient.defaults.timeout = DEFAULT_TIMEOUT;
  }
}

// Create and export singleton instance
const baniDBService = new BaniDBService();

export default baniDBService;
export { BaniDBService };