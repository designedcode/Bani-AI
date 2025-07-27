/**
 * Fuzzy search utilities using fuse.js library to replace rapidfuzz
 * Ported from Python backend fuzzy_search_sggs function
 */

import Fuse, { IFuseOptions } from 'fuse.js';
import { FuzzyMatch, FuzzySearchConfig } from '../types/SearchTypes';
import { normalizeUnicode } from './TextProcessingUtils';

// Default fuzzy search configuration
const DEFAULT_FUZZY_CONFIG: FuzzySearchConfig = {
  threshold: 40, // Minimum score threshold (0-100)
  maxResults: 10 // Maximum number of results to return
};

// Fuse.js configuration for Gurmukhi text search
const FUSE_OPTIONS: IFuseOptions<string> = {
  includeScore: true,
  includeMatches: false,
  threshold: 0.6, // Fuse.js threshold (0-1, lower is more strict)
  ignoreLocation: true,
  ignoreFieldNorm: true,
  minMatchCharLength: 1,
  shouldSort: true,
  keys: [] // We're searching strings directly, not objects
};

/**
 * Fuzzy search SGGS lines using fuse.js library
 * Ported from Python fuzzy_search_sggs function
 * 
 * @param query - The search query text
 * @param sggs_lines - Array of SGGS text lines to search through
 * @param config - Optional fuzzy search configuration
 * @returns Array of fuzzy matches with scores
 */
export function fuzzySearchSGGS(
  query: string, 
  sggs_lines: string[], 
  config: Partial<FuzzySearchConfig> = {}
): FuzzyMatch[] {
  // Merge with default config
  const searchConfig = { ...DEFAULT_FUZZY_CONFIG, ...config };
  
  console.log(`DEBUG: fuzzySearchSGGS - query='${query}', lines=${sggs_lines.length}, threshold=${searchConfig.threshold}`);
  
  // Return empty if no query or no lines
  if (!query.trim() || !sggs_lines.length) {
    console.log("DEBUG: Empty query or no SGGS lines available");
    return [];
  }
  
  // Normalize the query text
  const normalizedQuery = normalizeUnicode(query.trim(), 'NFC');
  
  // Normalize all SGGS lines for consistent comparison
  const normalizedLines = sggs_lines.map(line => normalizeUnicode(line, 'NFC'));
  
  // Create Fuse instance with normalized lines
  const fuse = new Fuse(normalizedLines, FUSE_OPTIONS);
  
  // Perform fuzzy search
  const fuseResults = fuse.search(normalizedQuery);
  
  console.log(`DEBUG: Fuse.js returned ${fuseResults.length} results`);
  
  // Convert Fuse.js results to our FuzzyMatch format
  const matches: FuzzyMatch[] = fuseResults.map(result => {
    // Convert Fuse.js score (0-1, lower is better) to percentage score (0-100, higher is better)
    const fuseScore = result.score || 0;
    const percentageScore = Math.round((1 - fuseScore) * 100);
    
    return {
      text: result.item,
      score: percentageScore,
      index: result.refIndex
    };
  });
  
  // Filter by threshold and limit results
  const filteredMatches = matches
    .filter(match => match.score >= searchConfig.threshold)
    .slice(0, searchConfig.maxResults);
  
  console.log(`DEBUG: After filtering by threshold (${searchConfig.threshold}): ${filteredMatches.length} matches`);
  
  if (filteredMatches.length > 0) {
    const bestMatch = filteredMatches[0];
    console.log(`DEBUG: Best match - Score=${bestMatch.score}, Text='${bestMatch.text}'`);
  }
  
  return filteredMatches;
}

/**
 * Get the best fuzzy match from SGGS lines
 * Simplified version that returns only the top match
 * 
 * @param query - The search query text
 * @param sggs_lines - Array of SGGS text lines to search through
 * @param threshold - Minimum score threshold (default: 40)
 * @returns Best fuzzy match or null if no match above threshold
 */
export function getBestFuzzyMatch(
  query: string, 
  sggs_lines: string[], 
  threshold: number = DEFAULT_FUZZY_CONFIG.threshold
): FuzzyMatch | null {
  const matches = fuzzySearchSGGS(query, sggs_lines, { threshold, maxResults: 1 });
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Calculate fuzzy similarity ratio between two strings
 * Uses fuse.js internally to provide a ratio similar to rapidfuzz.fuzz.ratio
 * 
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score from 0-100 (higher is more similar)
 */
export function fuzzyRatio(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return 0;
  }
  
  // Normalize both strings
  const normalizedStr1 = normalizeUnicode(str1.trim(), 'NFC');
  const normalizedStr2 = normalizeUnicode(str2.trim(), 'NFC');
  
  // Handle exact matches
  if (normalizedStr1 === normalizedStr2) {
    return 100;
  }
  
  // Use Fuse.js to calculate similarity
  const fuse = new Fuse([normalizedStr2], FUSE_OPTIONS);
  const results = fuse.search(normalizedStr1);
  
  if (results.length === 0) {
    return 0;
  }
  
  // Convert Fuse.js score to percentage
  const fuseScore = results[0].score || 0;
  return Math.round((1 - fuseScore) * 100);
}

/**
 * Find fuzzy matches with scores above threshold
 * Similar to rapidfuzz.process.extract functionality
 * 
 * @param query - The search query
 * @param choices - Array of strings to search through
 * @param limit - Maximum number of results (default: 5)
 * @param threshold - Minimum score threshold (default: 40)
 * @returns Array of matches sorted by score (highest first)
 */
export function extractMatches(
  query: string,
  choices: string[],
  limit: number = 5,
  threshold: number = DEFAULT_FUZZY_CONFIG.threshold
): FuzzyMatch[] {
  return fuzzySearchSGGS(query, choices, { threshold, maxResults: limit });
}

/**
 * Validate fuzzy search configuration
 * 
 * @param config - Configuration to validate
 * @returns True if valid, false otherwise
 */
export function validateFuzzyConfig(config: Partial<FuzzySearchConfig>): boolean {
  if (config.threshold !== undefined) {
    if (config.threshold < 0 || config.threshold > 100) {
      console.error('Fuzzy search threshold must be between 0 and 100');
      return false;
    }
  }
  
  if (config.maxResults !== undefined) {
    if (config.maxResults < 1) {
      console.error('Fuzzy search maxResults must be at least 1');
      return false;
    }
  }
  
  return true;
}

/**
 * Create a fuzzy search instance with custom configuration
 * Useful for reusing the same configuration across multiple searches
 * 
 * @param sggs_lines - Array of SGGS lines to search
 * @param config - Custom fuzzy search configuration
 * @returns Object with search methods
 */
export function createFuzzySearcher(
  sggs_lines: string[],
  config: Partial<FuzzySearchConfig> = {}
) {
  const searchConfig = { ...DEFAULT_FUZZY_CONFIG, ...config };
  
  if (!validateFuzzyConfig(searchConfig)) {
    throw new Error('Invalid fuzzy search configuration');
  }
  
  const normalizedLines = sggs_lines.map(line => normalizeUnicode(line, 'NFC'));
  const fuse = new Fuse(normalizedLines, FUSE_OPTIONS);
  
  const searcher = {
    search: (query: string): FuzzyMatch[] => {
      if (!query.trim()) {
        return [];
      }
      
      const normalizedQuery = normalizeUnicode(query.trim(), 'NFC');
      const fuseResults = fuse.search(normalizedQuery);
      
      const matches: FuzzyMatch[] = fuseResults.map(result => {
        const fuseScore = result.score || 0;
        const percentageScore = Math.round((1 - fuseScore) * 100);
        
        return {
          text: result.item,
          score: percentageScore,
          index: result.refIndex
        };
      });
      
      return matches
        .filter(match => match.score >= searchConfig.threshold)
        .slice(0, searchConfig.maxResults);
    },
    
    getBest: (query: string): FuzzyMatch | null => {
      const matches = searcher.search(query);
      return matches.length > 0 ? matches[0] : null;
    },
    
    config: searchConfig
  };
  
  return searcher;
}

// Export default configuration for external use
export { DEFAULT_FUZZY_CONFIG, FUSE_OPTIONS };