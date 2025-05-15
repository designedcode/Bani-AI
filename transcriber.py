# transcriber.py

import whisper

# Load Whisper model once when the module is imported
model = whisper.load_model("base")

def transcribe_audio(file_path):
    """
    Transcribe the given audio file using the local Whisper model.
    
    Args:
        file_path (str): Path to the audio file.

    Returns:
        str: Transcribed text.
    """
    print("⏳ Transcribing using local Whisper...")
    result = model.transcribe(file_path)
    return result["text"]