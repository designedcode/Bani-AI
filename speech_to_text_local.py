import whisper

model = whisper.load_model("base")

def transcribe_audio(file_path):
    result = model.transcribe(file_path, language="pa")
    print(result)  # Full debug info
    return result["text"]

if __name__ == "__main__":
    file_path = input("Enter audio file path: ").strip()
    print("⏳ Transcribing using local Whisper...")
    try:
        text = transcribe_audio(file_path)
        print(f"\n📜 Transcription:\n{text}")
    except Exception as e:
        print(f"❌ Error: {e}")