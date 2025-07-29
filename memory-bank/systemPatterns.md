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
- Uses phrases of 2, 3, or 4 words from the transcription.
- Compares each phrase to each line using a custom similarity function (Levenshtein-based, normalized, diacritics removed).
- Contextual score rewards sequential word matches and position.
- **Thresholds:**
  - PHRASE_MATCH_THRESHOLD = 60 (for initial match)
  - SEQUENTIAL_MATCH_THRESHOLD = 40 (for sequential/next-verse match)
  - Word-level similarity threshold: 0.7 (for word-to-word match)
  - HIGHLIGHT_THRESHOLD = 0.6 (for line highlighting, but actual use is via the above thresholds)
- Only the best-matching line is highlighted at a time.
- If no match is above the threshold, falls back to a broader search.
- Auto-scrolls to the highlighted line.
- If the last or second-last line is matched, triggers loading the next shabad. 