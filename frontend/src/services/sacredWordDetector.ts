// Fast exact matching for sacred words - no fuzzy search needed for performance
const SACRED_PATTERNS = [
  // Longer phrases first (for better matching priority)
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
 // 'ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ', as it's searchable 
  'ਇਕ ਓਕਾਰ',
  'ਇ ਓਕਾਰ',
  'ਇਕ ਓਂਕਾਰ',
  'ਬੋਲੇ ਸੋ',
  'ਸੋ ਨਿਹਾਲ',
  // 'ਸਤਿ ਸ੍ਰੀ',
  // 'ਸ੍ਰੀ ਅਕਾਲ',
  // 'ਜੀ ਕਾ',
  // 'ਕਾ ਖਾਲਸਾ',
  // 'ਕਾ ਖ਼ਾਲਸਾ',
  // 'ਜੀ ਕੀ',
  // 'ਕੀ ਫਤਿਹ',
  // 'ਕੀ ਫ਼ਤਿਹ',

  // Single words
  'ਵਾਹਿਗੁਰੂ',
  'ਇਓਕਾਰ',
  'ੴ'
]

// Pre-normalize patterns for consistent comparison and performance
const NORMALIZED_PATTERNS = SACRED_PATTERNS.map(p => p.normalize('NFC'))

// Combined function that detects and removes sacred words in one pass
export function detectAndRemoveSacredWords(
  text: string,
  context: 'general' | 'shabad' = 'general'
): { matches: any[], filteredText: string } {
  if (!text || text.trim().length === 0) {
    return { matches: [], filteredText: text }
  }

  const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim()
  let filteredText = normalized
  const matches = []

  // Single pass through patterns for both detection and removal
  for (const pattern of NORMALIZED_PATTERNS) {
    // Check for match
    if (normalized.includes(pattern)) {
      // Add to matches (only first match for priority)
      if (matches.length === 0) {
        matches.push({
          match: pattern,
          displayText: pattern,
          rule: { context: 'both' },
          score: 1.0
        })
      }

      // Remove from text if found
      if (filteredText.includes(pattern)) {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        filteredText = filteredText.replace(regex, '').replace(/\s+/g, ' ').trim()
      }
    }
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





// Fast removal function using optimized approach
export function removeSacredWords(text: string): string {
  if (!text || text.trim().length === 0) {
    return text
  }

  // Normalize and clean up spaces first
  let result = text.normalize('NFC').replace(/\s+/g, ' ').trim()

  // Remove patterns (longest first to avoid partial removal issues)
  for (const pattern of NORMALIZED_PATTERNS) {
    const normalizedPattern = pattern
    
    // Try exact match first
    if (result.includes(normalizedPattern)) {
      // Use global replacement
      const regex = new RegExp(normalizedPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      const beforeRemoval = result
      result = result.replace(regex, '').replace(/\s+/g, ' ').trim()
      
      // If we removed something, break to avoid over-processing
      if (result !== beforeRemoval) {
        break
      }
    }
  }

  return result
}