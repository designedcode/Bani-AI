# banidb.py
import requests
import urllib.parse

# Helper: Get first letters from a Gurbani line
def get_first_letters(text):
    words = text.split()
    first_letters = ''.join(word[0] for word in words if word)
    return first_letters.lower()

def fetch_metadata_from_banidb(search_text):
    print("🌐 Querying BaniDB using first-letter search...")

    first_letter_search = get_first_letters(search_text)
    print(f"🔠 First-Letter Query: {first_letter_search}")

    encoded_text = urllib.parse.quote(first_letter_search)
    url = f"https://api.banidb.com/v2/search/{encoded_text}?source=all&searchtype=7&writer=all&page=1"

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        if "verses" in data and len(data["verses"]) > 0:
            return data["verses"][0]
        else:
            print("⚠️ No verses found in BaniDB response.")
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")

    return None