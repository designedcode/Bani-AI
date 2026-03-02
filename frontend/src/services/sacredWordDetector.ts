import { SacredWordTrie } from './sacredWordTrie';

// Fast exact matching for sacred words - no fuzzy search needed for performance
export const SACRED_PATTERNS = [
  // Longer phrases first
  'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
  // Mool Mantar starts
  'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
  'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
  'ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
  'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
  'ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰੁ',
  'ਸਤਿਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ',
  'ਸਤਿ ਨਾਮ ਕਰਤਾ ਪੁਰਖ ਨਿਰਭਉ ਨਿਰਵੈਰ',
  'ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ',
  //Mool Mantar Ends
  'ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਜੀ ਕਾ ਖਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ',
  'ਬੋਲੇ ਸੋ ਨਿਹਾਲ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',
  'ਧੰਨ ਗੁਰੂ ਨਾਨਕ',
  'ਧਨ ਗੁਰੂ ਨਾਨਕ',
  'ਧੰਨ ਗੁਰ ਨਾਨਕ',
  'ਧਨ ਗੁਰ ਨਾਨਕ',

  // Three word phrases
  'ਜੀ ਕਾ ਖਾਲਸਾ',
  'ਜੀ ਕਾ ਖ਼ਾਲਸਾ',
  'ਜੀ ਕੀ ਫਤਿਹ',
  'ਜੀ ਕੀ ਫ਼ਤਿਹ',
  'ਬੋਲੇ ਸੋ ਨਿਹਾਲ',
  'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ',

  // Two word phrases
  'ਵਾਹਿਗੁਰੂ ਵਾਹਿਗੁਰੂ',
  'ਇਕ ਓਕਾਰ',
  'ਇ ਓਕਾਰ',
  'ਇਕ ਓਂਕਾਰ',
  'ਬੋਲੇ ਸੋ',
  'ਸੋ ਨਿਹਾਲ',

  // Single words
  'ਵਾਹਿਗੁਰੂ',
  'ਇਓਕਾਰ',
  'ੴ'
];

// Initialize the shared Trie
const sacredTrie = new SacredWordTrie(SACRED_PATTERNS);

// Combined function that detects and removes sacred words in one pass
export function detectAndRemoveSacredWords(
  text: string,
  _context: 'general' | 'shabad' = 'general'
): { matches: any[], filteredText: string } {
  if (!text || text.trim().length === 0) {
    return { matches: [], filteredText: text }
  }

  const normalized = text.normalize('NFC').trim()
  const words = normalized.split(/\s+/)
  const matches: any[] = []

  // Use Trie to find all non-overlapping matches
  const foundMatches = sacredTrie.findAllMatches(normalized);

  if (foundMatches.length === 0) {
    return { matches: [], filteredText: normalized };
  }

  // Create matches for return (taking first one for backward compatibility if needed, 
  // though we could return all)
  foundMatches.forEach(m => {
    matches.push({
      match: m.phrase,
      displayText: m.phrase,
      rule: { context: 'both' },
      score: 1.0
    });
  });

  // Efficiently remove matched phrases
  let filteredText = normalized;
  // Sort by length descending to remove longest first if they overlap (though Trie avoids this mostly)
  const sortedMatches = [...foundMatches].sort((a, b) => b.phrase.length - a.phrase.length);

  for (const m of sortedMatches) {
    const regex = new RegExp(m.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    filteredText = filteredText.replace(regex, '').replace(/\s+/g, ' ').trim();
  }

  return { matches, filteredText }
}

// Keep original function for backward compatibility
export function detectSacredMatches(
  text: string,
  context: 'general' | 'shabad'
) {
  const result = detectAndRemoveSacredWords(text, context)
  return result.matches
}

// Fast removal function using optimized Trie approach
export function removeSacredWords(text: string): string {
  if (!text || text.trim().length === 0) {
    return text
  }

  const { filteredText } = detectAndRemoveSacredWords(text);
  return filteredText;
}

export { sacredTrie };
