# Tech Context

## Technologies Used
- **Backend**: Python 3.8+, FastAPI, httpx, aiofiles, rapidfuzz, uvicorn, SQLite
- **Frontend**: React, TypeScript, Web Speech API, HTTP REST API
- **Database**: SQLite (local `shabads_verses_SGGS.db`), External BaniDB API
- **Audio Processing**: Web Speech API (browser), file uploads (backend)
- **Search Algorithms**: Levenshtein distance, sequence matching, token-level similarity

## Development Setup
- Python dependencies in `backend/requirements.txt` (use `pip3` for installation)
- Node.js 16+ and npm for frontend
- Start scripts: `start.sh` for unified startup
- Backend runs on http://localhost:8000, frontend on http://localhost:3000
- SQLite database: `backend/uploads/shabads_verses_SGGS.db`

## Technical Constraints
- No persistent user authentication (MVP)
- Relies on external BaniDB API for Gurbani data
- Web Speech API browser support required for live transcription

## Dependencies
- See requirements.txt (backend) and package.json (frontend) for full lists 