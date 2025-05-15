import streamlit as st
import sounddevice as sd
import numpy as np
from scipy.io.wavfile import write
import whisper
import requests
import urllib.parse
import json

model = whisper.load_model("base")

def record_audio(duration=5, sample_rate=44100):
    st.write(f"🎙️ Recording for {duration} seconds...")
    recording = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='int16')
    sd.wait()
    temp_file = "temp.wav"
    write(temp_file, sample_rate, recording)
    return temp_file

def transcribe_audio(file_path):
    result = model.transcribe(file_path, language="pa")
    return result['text']

def get_first_letters(text):
    return ''.join(w[0] for w in text.split() if w).lower()

def fetch_metadata_banidb(line):
    search_letters = get_first_letters(line)
    print(f"🔤 First-Letter Query: {search_letters}")

    encoded = urllib.parse.quote(search_letters)
    print(f"🌐 Encoded Query: {encoded}")

    url = f"https://api.banidb.com/v2/search/{encoded}?source=all&searchtype=7&writer=all&page=1"
    print(f"🔗 Request URL: {url}")

    headers = {"User-Agent": "Mozilla/5.0"}
    res = requests.get(url, headers=headers)

    if res.status_code == 200:
        data = res.json()
        print("📥 Response JSON:", data)

        if "verses" in data and data["verses"]:
            return data["verses"][0]
    else:
        print(f"❌ Error {res.status_code}: {res.text}")

    return None

# --- Streamlit App ---
st.title("🔊 Live Gurbani Recognizer")
if st.button("🎙️ Record & Transcribe"):
    audio_file = record_audio()
    transcription = transcribe_audio(audio_file)
    st.success(f"📜 Transcription: {transcription}")

    metadata = fetch_metadata_banidb(transcription)
    if metadata:
        st.markdown("### ✅ Matched BaniDB Metadata")
        st.write(f"**Gurmukhi**: {metadata['verse']['unicode']}")
        st.write(f"**Translation**: {metadata['translation']['en'].get('bdb', 'No Translation')}")
        st.write(f"**Raag**: {metadata['raag'].get('english', 'Unknown')}")
        st.write(f"**Page**: {metadata.get('pageNo', 'Unknown')}")
    else:
        st.warning("No match found on BaniDB.")