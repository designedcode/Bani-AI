from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import httpx
from typing import List, Optional
import logging
import os
import aiofiles
from pathlib import Path
import re
import asyncio
from collections import defaultdict
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Bani AI Transcription", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# BaniDB API configuration
BANIDB_API_BASE_URL = "https://api.banidb.com/v2"
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Create a shared HTTP client with connection pooling for better performance
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(10.0, connect=5.0),  # Reduced timeout
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
    http2=True  # Enable HTTP/2 for better performance
)

# Debouncing mechanism to avoid too many API calls
search_cache = {}
last_search_time = defaultdict(float)
DEBOUNCE_DELAY = 0.5  # 500ms debounce delay

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

def strip_gurmukhi_matras(text: str) -> str:
    """
    Strip matras (vowel signs) from Gurmukhi text, keeping only the main letters.
    This helps with search as BaniDB expects simplified Gurmukhi.
    """
    if not text:
        return ""
    
    # Remove common matras and diacritics
    # These are the Unicode ranges for Gurmukhi matras and diacritics
    matras_to_remove = [
        '\u0A3E',  # ਾ (aa)
        '\u0A3F',  # ਿ (i)
        '\u0A40',  # ੀ (ii)
        '\u0A41',  # ੁ (u)
        '\u0A42',  # ੂ (uu)
        '\u0A47',  # ੇ (e)
        '\u0A48',  # ੈ (ai)
        '\u0A4B',  # ੋ (o)
        '\u0A4C',  # ੌ (au)
        '\u0A4D',  # ੍ (halant/virama)
        '\u0A70',  # ੰ (tippi)
        '\u0A71',  # ੱ (addak)
        '\u0A02',  # ਂ (bindi)
        '\u0A01',  # ਁ (candrabindu)
    ]
    
    # Remove matras
    for matra in matras_to_remove:
        text = text.replace(matra, '')
    
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

async def search_banidb_api(query: str, source: str = "all") -> List[dict]:
    """Search BaniDB API for Gurbani text with caching and debouncing"""
    if not query.strip():
        return []
    
    # Strip matras from the query
    stripped_query = strip_gurmukhi_matras(query)
    logger.info(f"Original query: '{query}' -> Stripped: '{stripped_query}'")
    
    if not stripped_query:
        return []
    
    # Check cache first
    cache_key = f"{stripped_query}_{source}"
    if cache_key in search_cache:
        logger.info(f"Cache hit for query: '{stripped_query}'")
        return search_cache[cache_key]
    
    # Debouncing: skip if too soon after last search
    current_time = time.time()
    if current_time - last_search_time[stripped_query] < DEBOUNCE_DELAY:
        logger.info(f"Debouncing search for: '{stripped_query}'")
        return []
    
    last_search_time[stripped_query] = current_time
    
    try:
        # Use the shared HTTP client for better performance
        search_url = f"{BANIDB_API_BASE_URL}/search/{stripped_query}"
        params = {
            "source": source,
            "searchtype": "6",
            "writer": "all",
            "page": "1",
            "livesearch": "1"
        }
        
        response = await http_client.get(search_url, params=params)
        response.raise_for_status()
        
        data = response.json()
        results = []
        
        # The API returns "verses" not "results"
        if "verses" in data:
            for verse in data["verses"][:10]:  # Limit to 10 results
                results.append({
                    "gurmukhi_text": verse.get("verse", {}).get("unicode", ""),
                    "english_translation": verse.get("translation", {}).get("en", {}).get("bdb", ""),
                    "verse_id": verse.get("verseId", 0),
                    "shabad_id": verse.get("shabadId", 0),
                    "source": "Guru Granth Sahib",  # Default source
                    "writer": "Guru Nanak Dev Ji",  # Default writer
                    "raag": ""  # Will be populated if available
                })
        
        # Cache the results for 5 minutes
        search_cache[cache_key] = results
        logger.info(f"BaniDB search returned {len(results)} results for query: '{stripped_query}'")
        return results
        
    except httpx.RequestError as e:
        logger.error(f"BaniDB API request error: {e}")
        return []
    except Exception as e:
        logger.error(f"BaniDB API error: {e}")
        return []

# Clean up cache periodically
async def cleanup_cache():
    """Clean up old cache entries every 5 minutes"""
    while True:
        await asyncio.sleep(300)  # 5 minutes
        current_time = time.time()
        # Keep only recent cache entries (last 10 minutes)
        old_keys = [k for k, v in search_cache.items() if current_time - v.get('_timestamp', 0) > 600]
        for key in old_keys:
            del search_cache[key]
        logger.info(f"Cleaned up {len(old_keys)} old cache entries")

@app.get("/")
async def root():
    return {"message": "Bani AI Transcription API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Bani AI Transcription"}

@app.post("/api/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload audio file for transcription"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
    allowed_extensions = {'.mp3', '.wav', '.m4a', '.ogg', '.flac'}
    file_extension = Path(file.filename).suffix.lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save file
    file_path = UPLOAD_DIR / f"{file.filename}"
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        logger.info(f"Audio file uploaded: {file_path}")
        
        # For MVP, we'll return a placeholder response
        # In production, you'd integrate with a transcription service here
        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "file_path": str(file_path),
            "transcription": "Placeholder transcription - integrate with transcription service"
        }
        
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail="Error uploading file")

@app.websocket("/ws/transcription")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive transcription data from frontend
            data = await websocket.receive_text()
            transcription_data = json.loads(data)
            
            # Process the transcription
            transcribed_text = transcription_data.get("text", "")
            confidence = transcription_data.get("confidence", 0)
            
            logger.info(f"Received transcription: {transcribed_text} (confidence: {confidence})")
            
            # Search in BaniDB API with optimized function
            search_results = await search_banidb_api(transcribed_text)
            
            # Send results back to client immediately
            response = {
                "type": "search_result",
                "transcribed_text": transcribed_text,
                "confidence": confidence,
                "results": search_results,
                "timestamp": time.time()
            }
            
            await manager.send_personal_message(json.dumps(response), websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/search")
async def search_endpoint(query: str, source: str = "all"):
    """REST endpoint for searching BaniDB"""
    results = await search_banidb_api(query, source)
    return {"query": query, "results": results}

@app.get("/api/sources")
async def get_sources():
    """Get available sources from BaniDB"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BANIDB_API_BASE_URL}/sources", timeout=30.0)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Error fetching sources: {e}")
        return {"sources": []}

@app.get("/api/strip-matras")
async def strip_matras_endpoint(text: str):
    """Test endpoint to strip matras from Gurmukhi text"""
    stripped = strip_gurmukhi_matras(text)
    return {
        "original": text,
        "stripped": stripped,
        "length_original": len(text),
        "length_stripped": len(stripped)
    }

if __name__ == "__main__":
    import uvicorn
    
    # Start cache cleanup task
    loop = asyncio.get_event_loop()
    loop.create_task(cleanup_cache())
    
    uvicorn.run(app, host="0.0.0.0", port=8000) 