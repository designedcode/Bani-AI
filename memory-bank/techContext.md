# Tech Context

## Technologies Used
- **Backend**: Python 3.8+, FastAPI, httpx, aiofiles, rapidfuzz, uvicorn
- **Frontend**: React, TypeScript, Web Speech API, WebSocket
- **Database**: External BaniDB API (no local DB)
- **Audio Processing**: Web Speech API (browser), file uploads (backend)

## Development Setup
- Python dependencies in requirements.txt
- Node.js 16+ and npm for frontend
- Start scripts: start.sh for unified startup
- Backend runs on http://localhost:8000, frontend on http://localhost:3000

## Technical Constraints
- No persistent user authentication (MVP)
- Relies on external BaniDB API for Gurbani data
- Web Speech API browser support required for live transcription

## Dependencies
- See requirements.txt (backend) and package.json (frontend) for full lists 