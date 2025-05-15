# main.py
from transcriber import transcribe_audio
from sggs_loader import load_sggs_json
from matcher import fuzzy_match_local_sggs
from banidb import fetch_metadata_from_banidb

if __name__ == "__main__":
    audio_path = input("\U0001F399️ Enter path to your Punjabi audio file: ").strip()

    # Step 1: Transcribe audio
    transcription = transcribe_audio(audio_path)
    print(f"\n📜 Transcription:\n{transcription}")

    # Step 2: Load SGGS JSON
    sggs_data = load_sggs_json()

    # Step 3: Fuzzy match locally
    match = fuzzy_match_local_sggs(transcription, sggs_data)

    if match:
        print("\n✅ Best Matching Gurbani Line (Local SGGS Search):")
        print(f"➤ Line    : {match['line']}")
        print(f"➤ Ang/Page: {match.get('ang', 'Unknown')}")

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
