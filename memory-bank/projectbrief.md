# Project Brief

Bani AI is a real-time Punjabi audio transcription and search system. Its core goal is to transcribe spoken Punjabi (in Gurmukhi script) and enable users to search the transcribed text within the Gurbani database (BaniDB). The project aims to make Gurbani more accessible by leveraging modern speech recognition and search technologies.

## Core Requirements & Goals
- Real-time audio transcription in Punjabi (Gurmukhi script)
- Support for live microphone input
- Integration with BaniDB for searching Gurbani verses
- Intelligent matra (diacritic) stripping for improved search accuracy
- HTTP REST API communication between frontend and backend
- Modern, user-friendly web interface
- Display of search results with Gurmukhi text, English translations, verse IDs, and source info

## Project Scope
- Backend: FastAPI-based API for audio upload, search, and real-time communication
- Frontend: React + TypeScript app for user interaction and visualization
- No persistent user accounts or authentication in MVP
- Uses external BaniDB API for Gurbani data
- Local fuzzy search on SGGS.txt for enhanced matching 