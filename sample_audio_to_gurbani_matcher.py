import whisper
import json
from rapidfuzz import fuzz, process

# Load the Whisper model
model = whisper.load_model("base")

# Load Gurbani data
def load_gurbani_data(file_path='gurbani.json'):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return []

# Fuzzy matching
def find_best_matches(query, data, threshold=50):
    choices = [entry["line"] for entry in data]
    results = process.extract(query, choices, scorer=fuzz.partial_ratio, limit=3)

    matches = []
    for matched_text, score, index in results:
        if score >= threshold:
            matches.append({
                "matched_line": matched_text,
                "translation": data[index]["translation"],
                "score": score
            })
    return matches

# Transcribe audio file
def transcribe_audio(file_path):
    print("⏳ Transcribing using local Whisper...")
    result = model.transcribe(file_path, language="pa")  # Punjabi
    return result["text"]

# MAIN
if __name__ == "__main__":
    audio_path = input("🎙️ Enter path to audio file: ").strip()
    
    transcription = transcribe_audio(audio_path)
    print(f"\n📜 Transcription:\n{transcription}")

    gurbani_data = load_gurbani_data()
    if not gurbani_data:
        exit()

    print("\n🔍 Matching against Gurbani...")
    matches = find_best_matches(transcription, gurbani_data)

    if matches:
        print("\n✅ Matches:")
        for m in matches:
            print(f"✔ Line: {m['matched_line']}")
            print(f"   ➤ Translation: {m['translation']}")
            print(f"   🔢 Score: {m['score']}\n")
    else:
        print("❌ No strong match found.")