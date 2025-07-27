// Core search result interface based on BaniDB API response
export interface SearchResult {
  gurmukhi_text: string;
  english_translation: string;
  verse_id: number;
  shabad_id: number;
  source: string;
  writer: string;
  raag: string;
}

// Transcription data interface for WebSocket communication
export interface TranscriptionData {
  text: string;
  confidence: number;
  timestamp: number;
  sggs_match_found: boolean;
  fallback_used: boolean;
  best_sggs_match: string | null;
  best_sggs_score: number | null;
}

// SGGS index interfaces for text processing
export interface SGGSIndex {
  [token: string]: number[];
}

export interface SGGSLineMap {
  [lineId: string]: string;
}

// BaniDB API response types
export interface BaniDBSearchResponse {
  verses: BaniDBVerse[];
  count?: number;
  page?: number;
}

export interface BaniDBVerse {
  verse: {
    unicode: string;
    gurmukhi?: string;
  };
  translation: {
    en: {
      bdb: string;
    };
  };
  verseId: number;
  shabadId: number;
  pageNo?: number;
  lineNo?: number;
  transliteration?: {
    english: string;
  };
}

export interface BaniDBShabadResponse {
  shabadInfo: {
    shabadId: number;
    shabadName?: string;
    pageNo?: number;
    source: {
      unicode: string;
    };
    raag: {
      unicode: string;
    };
    writer: {
      english: string;
    };
  };
  verses: BaniDBVerse[];
  count: number;
  navigation?: {
    previous?: number;
    next?: number;
  };
}

export interface BaniDBSourcesResponse {
  sources: Array<{
    id: number;
    unicode: string;
    english: string;
  }>;
}

// Full shabad display interface (mapped from BaniDB response)
export interface FullShabadData {
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
  lines_highlighted: ShabadLine[];
}

export interface ShabadLine {
  gurmukhi_highlighted: string;
  gurmukhi_original: string;
  transliteration: string;
  translation: string;
  page_no?: number;
  line_no?: number;
  verse_id: number;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'search_result' | 'transcription' | 'error';
  data?: any;
}

export interface SearchResultMessage extends WebSocketMessage {
  type: 'search_result';
  transcribed_text: string;
  confidence: number;
  results: SearchResult[];
  timestamp: number;
  sggs_match_found: boolean;
  fallback_used: boolean;
  best_sggs_match: string | null;
  best_sggs_score: number | null;
}

export interface TranscriptionMessage extends WebSocketMessage {
  type: 'transcription';
  text: string;
  confidence: number;
}

// Error handling types and enums
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  DATA_LOADING_ERROR = 'DATA_LOADING_ERROR',
  SEARCH_ERROR = 'SEARCH_ERROR',
  TRANSCRIPTION_ERROR = 'TRANSCRIPTION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface ApiError {
  type: ErrorType;
  message: string;
  code?: string | number;
  details?: any;
  timestamp: number;
}

export interface ServiceError extends Error {
  type: ErrorType;
  code?: string | number;
  details?: any;
}

// Search configuration types
export interface SearchConfig {
  source: string;
  searchtype: string;
  writer: string;
  page: string;
  livesearch: string;
}

export interface FuzzySearchConfig {
  threshold: number;
  maxResults: number;
}

// Text processing types
export interface TextProcessingResult {
  original: string;
  stripped: string;
  first_letters: string;
  length_original: number;
  length_stripped: number;
  length_first_letters: number;
}

export interface FuzzyMatch {
  text: string;
  score: number;
  index?: number;
}

// Cache types for service layer
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

export interface SearchCache {
  [key: string]: CacheEntry<SearchResult[]>;
}

// Service response types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Connection manager types for WebSocket handling
export interface ConnectionState {
  connected: boolean;
  topResultFound: boolean;
  lastSearchTime: number;
}

// Search types enum for BaniDB API
export enum SearchType {
  FIRST_LETTERS = '1',
  FIRST_LETTERS_ANYWHERE = '2',
  FULL_WORD = '3',
  FULL_WORD_GURMUKHI = '4',
  ENGLISH_TRANSLATION = '5',
  FULL_TEXT = '6'
}

// Source types for BaniDB API
export enum SourceType {
  ALL = 'all',
  GURU_GRANTH_SAHIB = 'G',
  DASAM_GRANTH = 'D',
  BHAI_GURDAS_VAARAN = 'B',
  BHAI_GURDAS_KABIT = 'N',
  BHAI_NAND_LAL = 'A',
  SARABLOH_GRANTH = 'S'
}