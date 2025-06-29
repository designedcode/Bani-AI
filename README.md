# Bani AI - Punjabi Audio Transcription & Search

A real-time Punjabi audio transcription system that transcribes audio in Gurmukhi script and searches the transcribed text in the BaniDB database (Gurbani database).

## Features

- **Real-time Audio Transcription**: Uses Web Speech API for live Punjabi transcription
- **File Upload Support**: Upload audio files for transcription
- **BaniDB Integration**: Search transcribed text in the Gurbani database
- **Matra Stripping**: Intelligently strips Gurmukhi matras for better search results
- **WebSocket Communication**: Real-time updates between frontend and backend
- **Modern UI**: React-based frontend with drag-and-drop file upload

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React with TypeScript
- **Real-time**: WebSocket
- **Database**: BaniDB API (external)
- **Audio Processing**: Web Speech API

## Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Bani-AI-New-Approach
   ```

2. **Install backend dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

## Running the Application

### Option 1: Use the start script
```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual start

1. **Start the backend**
   ```bash
   cd backend
   python main.py
   ```
   Backend will run on http://localhost:8000

2. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm start
   ```
   Frontend will run on http://localhost:3000

## Usage

1. **Real-time Transcription**:
   - Click the microphone button to start live transcription
   - Speak in Punjabi and see real-time transcription
   - Search results from BaniDB will appear automatically

2. **File Upload**:
   - Drag and drop audio files or click to browse
   - Supported formats: MP3, WAV, M4A, OGG, FLAC
   - Uploaded files are processed for transcription

3. **Search Results**:
   - View Gurmukhi text and English translations
   - See verse IDs and source information
   - Results are displayed in real-time as you speak

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/upload-audio` - Upload audio file
- `GET /api/search` - Search BaniDB
- `GET /api/sources` - Get available sources
- `GET /api/strip-matras` - Test matra stripping
- `WebSocket /ws/transcription` - Real-time transcription

## Project Structure

```
Bani-AI-New-Approach/
├── backend/
│   ├── main.py              # FastAPI application
│   └── uploads/             # Uploaded audio files
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── types/          # TypeScript types
│   │   └── App.tsx         # Main app component
│   ├── package.json
│   └── tsconfig.json
├── requirements.txt         # Python dependencies
├── start.sh               # Startup script
└── README.md
```

## Configuration

The application uses the BaniDB API for Gurbani search. No additional configuration is required for basic functionality.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license here]

## Acknowledgments

- BaniDB API for providing Gurbani database access
- Web Speech API for audio transcription capabilities 