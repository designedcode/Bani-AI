import whisper
from fastapi import FastAPI, UploadFile, File
import shutil
import os

app = FastAPI()

model = whisper.load_model("medium")

@app.get("/")
def home():
    return {"message": "Speech to Text API running"}

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    
    temp_file = file.filename
    
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = model.transcribe(temp_file, language="pa")

    os.remove(temp_file)

    return {"transcription": result["text"]}