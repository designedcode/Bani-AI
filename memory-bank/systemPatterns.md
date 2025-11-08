# System Patterns

## System Architecture
- **Frontend**: React (TypeScript) single-page app for user interaction, audio capture, and result display
- **Backend**: FastAPI (Python) server for REST API endpoints
- **External API**: BaniDB API for Gurbani search and metadata
- **Local Data**: SGGS.txt file for local fuzzy search

## Key Technical Decisions
- Use of Web Speech API for browser-based real-time Punjabi transcription
- REST API for reliable HTTP-based communication between frontend and backend
- Fuzzy search on SGGS.txt for improved matching and fallback
- Matra stripping to normalize Gurmukhi input for better search accuracy
- Async HTTP client (httpx) for efficient BaniDB API calls

## Design Patterns
- TranscriptionService class for managing HTTP API calls
- Debouncing and caching to reduce redundant API calls
- Modular React components for UI (TranscriptionPanel, AudioVisualizer, SearchResults, FullShabadDisplay)

## Component Relationships
- Frontend sends audio transcription to backend via HTTP POST
- Backend processes transcription, performs fuzzy/local and BaniDB search, and returns results
- UI updates in real time as results are received 

## Gurbani Search and Highlighting Logic (Detailed)

### SGGS Search (Backend)
- Loads all lines from SGGS.txt into memory at startup.
- Uses rapidfuzz.fuzz.ratio for fuzzy matching.
- **Threshold:** FUZZY_THRESHOLD = 40 (default, can be set via env var FUZZY_MATCH_THRESHOLD)
- For each search, computes the fuzzy ratio between the query and every line.
- Returns the line with the highest score. If above threshold, considered a match; otherwise, still returns the best line and score for fallback.
- Only the best match is returned.

### BaniDB Search (Backend)
- Calls BaniDB API /search/{query} endpoint.
- Parameters: source="all", searchtype="6" (full text), fallback to searchtype="1" (first letters), page=1, livesearch=1.
- Debounce: 0.5 seconds between identical queries.
- Only the first 10 results are returned.
- Results are cached for 5 minutes.
- If no results with searchtype=6, tries searchtype=1 (first letters of each word).

### Shabad Search (Backend)
- Fetches a full shabad by shabadId from BaniDB (/shabads/{shabadId}).
- If not found and verseId is provided, fetches by verse.
- Maps BaniDB response to frontend format, including all lines and metadata.
- No thresholds or limits (returns all lines in the shabad).

### Frontend Shabad Line Highlighting
- Progressive fuzzy search matches transcribed text to lines in the shabad.
- Uses phrases of 4, 3, or 2 words from the transcription (prioritizes longer phrases first).
- Compares each phrase to each line using multiple scoring methods:
  - Sequence matching: checks if phrase words appear in sequential order
  - Direct similarity: Levenshtein-based similarity with sequence priority
  - Last word exact match: 10% weightage for exact match of last word
- **Scoring Algorithm:**
  - Base score: `max(contextualScore, directScore)` (90% weight)
  - Last word match: exact match check (10% weight)
  - Final score: `(baseScore * 0.9) + (lastWordMatchScore * 0.1)`
- **Thresholds:**
  - PHRASE_MATCH_THRESHOLD = 50 (for initial match, reduced from 60)
  - SEQUENTIAL_MATCH_THRESHOLD = 45 (for sequential/next-verse match, increased from 40)
  - Word-level similarity threshold: 0.7 (for word-to-word match in sequence)
  - Candidate persistence: 2 tokens (reduced from 3) before switching highlighted line
- **Phrase Generation:**
  - Only creates backward phrases (ending at the last word of transcription)
  - Prioritizes longer phrases: tries 4-word first, then 3-word, then 2-word
- Only the best-matching line is highlighted at a time.
- Candidate persistence: only switches highlight if same candidate persists for 2 consecutive tokens (reduces flickering).
- If no match is above the threshold, falls back to a broader search.
- Auto-scrolls to the highlighted line.
- If the last or second-last line is matched, triggers loading the next shabad.
- Logs highlight changes with associated scores for debugging. 