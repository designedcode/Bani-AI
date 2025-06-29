import whisper
import json
import requests
import urllib.parse
from rapidfuzz import fuzz, process

# Load Whisper model once
model = whisper.load_model("base")

# Step 1: Transcribe audio
def transcribe_audio(file_path):
    print("⏳ Transcribing using local Whisper...")
    result = model.transcribe(file_path, language="pa")
    return result["text"]

# Step 2: Load SGGS English JSON
def load_sggs_json(path="SriGranth_English.json"):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

# Step 3: Fuzzy match transcription against SGGS lines
def fuzzy_match_local_sggs(query, sggs_data, threshold=50):
    choices = [entry["line"] for entry in sggs_data]
    results = process.extract(query, choices, scorer=fuzz.partial_ratio, limit=3)

    for matched_line, score, index in results:
        if score >= threshold:
            return sggs_data[index]
    return None

# ➡️ Helper: Get first letters from a Gurbani line
def get_first_letters(text):
    words = text.split()
    first_letters = ''.join(word[0] for word in words if word)
    return first_letters.lower()

# Step 4: Fetch full metadata from BaniDB using first-letter search
def fetch_metadata_from_banidb(search_text):
    print("🌐 Querying BaniDB using first-letter search...")

    # Get first letters
    first_letter_search = get_first_letters(search_text)
    print(f"🔠 First-Letter Query: {first_letter_search}")

    # URL encode safely
    encoded_text = urllib.parse.quote(first_letter_search)

    # Correct API URL
    url = f"https://api.banidb.com/v2/search/{encoded_text}?source=all&searchtype=7&writer=all&page=1"

    # 🧠 Add User-Agent header to mimic a browser
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()

        # ✅ Fix: look inside "verses" instead of "results"
        if "verses" in data and len(data["verses"]) > 0:
            return data["verses"][0]  # First matching verse
        else:
            print("⚠️ No verses found in BaniDB response.")
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")

    return None

# MAIN Program
if __name__ == "__main__":
    audio_path = input("🎙️ Enter path to your Punjabi audio file: ").strip()

    # Step 1: Transcribe audio
    transcription = transcribe_audio(audio_path)
    print(f"\n📜 Transcription:\n{transcription}")

    # Step 2: Load SGGS JSON
    sggs_data = load_sggs_json()

    # Step 3: Fuzzy match locally
    match = fuzzy_match_local_sggs(transcription, sggs_data)

    if match:
        print("\n✅ Best Matching Gurbani Line (Local SGGS Search):")
        print(f"➡ Line    : {match['line']}")
        print(f"➡ Ang/Page: {match.get('ang', 'Unknown')}")

        # Step 4: Fetch metadata from BaniDB
        metadata = fetch_metadata_from_banidb(match["line"])

        if metadata:
            print("\n🗂️ Metadata from BaniDB:")
            print(f"📝 Gurmukhi Line   : {metadata['verse']['unicode']}")
            print(f"🌐 Translation    : {metadata['translation']['en'].get('bdb', 'No Translation Found')}")
            print(f"🎼 Raag           : {metadata['raag'].get('english', 'Unknown')}")
            print(f"✍️ Writer         : {metadata['writer'].get('english', 'Unknown') if metadata['writer'] else 'Unknown'}")
            print(f"📖 Ang/Page       : {metadata['pageNo']}")
        else:
            print("\n❌ No metadata found on BaniDB for this line.")
    else:
        print("\n❌ No strong match found in local SGGS database.")