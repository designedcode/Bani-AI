# Progress

## What works
- Real-time Punjabi audio transcription (Web Speech API)
- Integration with BaniDB API for Gurbani search
- Local fuzzy search on SGGS.txt
- Real-time frontend-backend communication via WebSocket
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
- Occasional mismatches in fuzzy search
- Web Speech API support varies by browser
- Real-time search in shabad keeps jumping due to the four word logic
- Printing of excessive console logs for debugging
