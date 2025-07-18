# System Patterns

## System Architecture
- **Frontend**: React (TypeScript) single-page app for user interaction, audio capture, and result display
- **Backend**: FastAPI (Python) server for API endpoints and WebSocket real-time communication
- **External API**: BaniDB API for Gurbani search and metadata
- **Local Data**: SGGS.txt file for local fuzzy search

## Key Technical Decisions
- Use of Web Speech API for browser-based real-time Punjabi transcription
- WebSocket for low-latency, real-time updates between frontend and backend
- Fuzzy search on SGGS.txt for improved matching and fallback
- Matra stripping to normalize Gurmukhi input for better search accuracy
- Async HTTP client (httpx) for efficient BaniDB API calls

## Design Patterns
- ConnectionManager class for managing WebSocket clients
- Debouncing and caching to reduce redundant API calls
- Modular React components for UI (TranscriptionPanel, AudioVisualizer, SearchResults, FullShabadDisplay)

## Component Relationships
- Frontend sends audio transcription to backend via WebSocket
- Backend processes transcription, performs fuzzy/local and BaniDB search, and returns results
- UI updates in real time as results are received 