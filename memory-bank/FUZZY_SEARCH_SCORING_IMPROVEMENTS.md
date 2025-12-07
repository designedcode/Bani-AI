# Fuzzy Search Scoring Improvements (November 2025)

## Overview
This document tracks the recent improvements to the fuzzy search scoring algorithm in `FullShabadDisplay.tsx`, focusing on enhancing search accuracy and reducing false positives in real-time transcription matching.

## Key Changes

### 1. Threshold Adjustments (Commit 1e2703e)
- **PHRASE_MATCH_THRESHOLD**: Reduced from 60 to 50 for initial phrase matching
- **SEQUENTIAL_MATCH_THRESHOLD**: Increased from 40 to 45 for sequential matches
- **Rationale**: Better balance between precision and recall, allowing slightly more lenient initial matching while maintaining quality for sequential searches

### 2. Phrase Length Prioritization (Commit 1e2703e)
- **Before**: `PHRASE_LENGTHS = [2, 3, 4]` (tried 2-word phrases first)
- **After**: `PHRASE_LENGTHS = [4, 3, 2]` (prioritizes longer phrases)
- **Rationale**: Longer phrases provide better context and reduce false matches. By checking 4-word phrases first, we get more accurate matches before falling back to shorter phrases.

### 3. Sequence Matching Implementation (Commit 3fb7537)
- **New Function**: `calculateSequenceScore()`
  - Checks if phrase words appear in sequential order within the text
  - Uses word-level similarity threshold of 0.7
  - Returns percentage score based on matched words
- **New Function**: `calculateDirectScoreWithSequence()`
  - Prioritizes sequence matches over simple Levenshtein similarity
  - Falls back to simple similarity if no sequence match found
- **Impact**: Better detection of phrases where words appear in order, even with slight variations

### 4. Last Word Exact Match Weighting (Commit 5905caa)
- **Feature**: 10% weightage for exact match of the last word in query
- **Implementation**:
  - Extracts last word from transcribed query
  - Checks for exact match in candidate lines
  - Combined score: `(baseScore * 0.9) + (lastWordMatchScore * 0.1)`
- **Rationale**: The last word in transcription is often the most recent and accurate, so exact matches should boost confidence

### 5. Candidate Persistence (Commits 2f6306e, 3fb7537)
- **Initial**: 3-token persistence before switching highlighted line
- **Final**: 2-token persistence (reduced in commit 3fb7537)
- **Logic**: Only updates highlighted line if the same candidate remains best for 2 consecutive transcription tokens
- **Impact**: Reduces flickering and jumping between lines during real-time transcription

### 6. Backward Phrase Generation (Commit 2f6306e)
- **Change**: Limited phrase generation to backward phrases only (ending at the last word)
- **Implementation**: `createPhrases()` now only creates phrases from the end of the transcribed text
- **Rationale**: Users typically speak sequentially, so the most recent words are most relevant

### 7. Scoring Algorithm Refinement (Commit 1e2703e)
- **Base Score Calculation**:
  ```typescript
  const contextualScore = calculateContextualScore(phrase, line);
  const directScore = calculateDirectScoreWithSequence(phrase, line);
  const baseScore = Math.max(contextualScore, directScore);
  ```
- **Final Score**:
  ```typescript
  const score = (baseScore * 0.9) + (lastWordMatchScore * 0.1);
  ```
- **Improvements**:
  - Removed position-based weighting (was causing issues)
  - Simplified contextual score to use sequence matching
  - Better integration of multiple scoring methods

## Technical Details

### Sequence Matching Algorithm
```typescript
function calculateSequenceScore(phrase: string, text: string): number {
  // 1. Split phrase and text into words
  // 2. For each possible starting position in text:
  //    - Check if phrase words appear in sequence
  //    - Use word-level similarity (threshold: 0.7)
  //    - Calculate average match score
  // 3. Return best score found (as percentage)
}
```

### Candidate Persistence Logic
```typescript
// Track candidate persistence
const candidatePersistenceRef = useRef<{ candidate: number | null; count: number }>({
  candidate: null,
  count: 0
});

// Only update if candidate persists for 2 tokens
if (candidatePersistenceRef.current.count >= 2) {
  setHighlightedLineIndex(newHighlightedIndex);
}
```

## Performance Impact

### Before Improvements
- Frequent line jumping during transcription
- Lower accuracy for longer phrases
- More false positives with shorter phrase matches

### After Improvements
- More stable highlighting (2-token persistence)
- Better accuracy with longer phrase prioritization
- Improved precision with sequence matching
- Reduced false positives with last word weighting

## Configuration Constants

```typescript
const PHRASE_MATCH_THRESHOLD = 50;        // Initial phrase match threshold
const SEQUENTIAL_MATCH_THRESHOLD = 45;    // Sequential match threshold
const PHRASE_LENGTHS = [4, 3, 2];         // Phrase lengths to try (priority order)
const CONTEXT_WINDOW_SIZE = 2;            // Current + next verse for sequential search
const CANDIDATE_PERSISTENCE = 2;          // Tokens before switching highlight
const LAST_WORD_WEIGHT = 0.1;             // 10% weight for last word exact match
const WORD_SIMILARITY_THRESHOLD = 0.7;    // Word-level similarity threshold
```

## Debugging Features

- Added logging for highlight changes: `[HIGHLIGHT CHANGE] Line: X Score: Y.YY`
- Console logs show when highlight changes occur with associated scores

## Future Considerations

1. **Dynamic Thresholds**: Consider adjusting thresholds based on transcription confidence
2. **Context Window**: May need to adjust `CONTEXT_WINDOW_SIZE` based on user behavior patterns
3. **Phrase Length**: Could experiment with 5-word phrases for even better accuracy
4. **Weight Tuning**: The 90/10 split for base/last-word score could be fine-tuned based on user feedback
5. **Persistence Tuning**: 2-token persistence may need adjustment based on transcription speed

## Related Files
- `frontend/src/components/FullShabadDisplay.tsx` - Main implementation
- `backend/main.py` - Backend fuzzy search (separate implementation)

## Commit History
- `1e2703e` - Refine fuzzy search scoring and Update dependency installation commands
- `cf83fe9` - Reverted code to state of backward phrases with persistence check
- `3fb7537` - Implement token-level and combined similarity functions
- `5905caa` - Added a 10% weightage to exact match of the last word
- `2f6306e` - Limited phrases to backwards only with last word and added 3 token persistence

