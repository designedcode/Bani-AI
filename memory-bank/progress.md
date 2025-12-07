# Progress

## What works
- Real-time Punjabi audio transcription (Web Speech API)
- Integration with BaniDB API for Gurbani search
- Local fuzzy search on SGGS.txt
- HTTP REST API communication between frontend and backend
- Modern, responsive UI with live results and audio visualization

## What's left to build
- Production-grade transcription service 
- Responsive mobile version of the website
- Beautiful UI for all responsive surfaces
- Enhanced error handling and user feedback
- More robust matra stripping and normalization
- User settings/preferences (e.g., search options, language)
- Accessibility improvements
- Deployment scripts and documentation
- Accurate searching of Shabads, logic improvements (last four words)

## Current status
- MVP functional for live transcription and search
- Cache for backend search
- Core search and display features are implemented

## Known issues
- Occasional mismatches in fuzzy search (improved with recent scoring changes)
- Web Speech API support varies by browser
- Real-time search stability improved with 2-token persistence (reduced jumping)
- Some debug logging still present (highlight change logging added for monitoring)

## Recent improvements (November 2025)
- Enhanced fuzzy search scoring with sequence matching and last-word weighting
- Improved line highlighting stability with candidate persistence (2 tokens)
- Better phrase prioritization (longer phrases first)
- Refined thresholds for better precision/recall balance
