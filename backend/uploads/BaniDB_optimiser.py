import sqlite3
import re
import os

# -----------------------------
#How it works
# 1. SQL Mahala Normalization
# Uses SQL REPLACE to standardize different Mahala formats (e.g., ਮ:, ਮਃ) into full forms like ਮਹਲਾ ਪਹਿਲਾ.

# 2. Regex Text Cleaning
# Applies Python regex to further normalize Mahala and Ghar terms, remove danda symbols (॥), Punjabi digits, and extra spaces.

# 3. Read Cleaned Data
# Fetches all verses from the database after cleaning, keeping them ordered.

# 4. Group by Shabad
# Combines consecutive rows with the same ShabadID into a single sequence of words.

# 5. Create Sliding Windows
# Breaks each Shabad into overlapping word windows (size 8, step 2) for modeling or analysis.

# 6. Save New Database
# Stores these windows into a fresh SQLite database with a simplified schema.

# 7. Summary Output
# Prints total number of generated windows and a small sample for verification.
# -----------------------------



# Paths
src_db = "/content/shabads_verses_SGGS_cleaned.db"
dst_db = "/content/shabads_verses_SGGS_window8_step2_final.db"

WINDOW_SIZE = 8
STEP_SIZE = 2

# -----------------------------
# STEP 1: SQL Mahala normalization
# -----------------------------
conn = sqlite3.connect(src_db)
cursor = conn.cursor()

sql_update_query = """
UPDATE Verse
SET GurmukhiUni =
REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
GurmukhiUni,

'ਮਹਲਾ ੧', 'ਮਹਲਾ ਪਹਿਲਾ'),
'ਮਹਲਾ ੨', 'ਮਹਲਾ ਦੂਜਾ'),
'ਮਹਲਾ ੩', 'ਮਹਲਾ ਤੀਜਾ'),
'ਮਹਲਾ ੪', 'ਮਹਲਾ ਚੌਥਾ'),
'ਮਹਲਾ ੫', 'ਮਹਲਾ ਪੰਜਵਾਂ'),
'ਮਹਲਾ ੯', 'ਮਹਲਾ ਨੌਵਾਂ'),

'ਮ: ੧', 'ਮਹਲਾ ਪਹਿਲਾ'),
'ਮ: ੨', 'ਮਹਲਾ ਦੂਜਾ'),
'ਮ: ੩', 'ਮਹਲਾ ਤੀਜਾ'),
'ਮ: ੪', 'ਮਹਲਾ ਚੌਥਾ'),
'ਮ: ੫', 'ਮਹਲਾ ਪੰਜਵਾਂ'),
'ਮ: ੯', 'ਮਹਲਾ ਨੌਵਾਂ'),

'ਮਃ ੧', 'ਮਹਲਾ ਪਹਿਲਾ'),
'ਮਃ ੨', 'ਮਹਲਾ ਦੂਜਾ'),
'ਮਃ ੩', 'ਮਹਲਾ ਤੀਜਾ'),
'ਮਃ ੪', 'ਮਹਲਾ ਚੌਥਾ'),
'ਮਃ ੫', 'ਮਹਲਾ ਪੰਜਵਾਂ'),
'ਮਃ ੯', 'ਮਹਲਾ ਨੌਵਾਂ');
"""

cursor.execute(sql_update_query)
conn.commit()

# -----------------------------
# STEP 2: Regex normalization
# -----------------------------

mahala_map = {
    "੧": "ਪਹਿਲਾ",
    "੨": "ਦੂਜਾ",
    "੩": "ਤੀਜਾ",
    "੪": "ਚੌਥਾ",
    "੫": "ਪੰਜਵਾਂ",
    "੯": "ਨੌਵਾਂ"
}

ghar_map = {
    "੧": "ਪਹਿਲਾ","੨": "ਦੂਜਾ","੩": "ਤੀਜਾ","੪": "ਚੌਥਾ","੫": "ਪੰਜਵਾਂ",
    "੬": "ਛੇਵਾਂ","੭": "ਸੱਤਵਾਂ","੮": "ਅੱਠਵਾਂ","੯": "ਨੌਂਵਾਂ",
    "੧੦": "ਦਸਵਾਂ","੧੧": "ਗਿਆਰਵਾਂ","੧੨": "ਬਾਰਵਾਂ","੧੩": "ਤੇਰਵਾਂ",
    "੧੪": "ਚੌਦਵਾਂ","੧੫": "ਪੰਦਰਵਾਂ","੧੬": "ਸੋਲਵਾਂ","੧੭": "ਸਤਾਰਵਾਂ"
}

def normalize_text(text):
    if text is None:
        return text

    # Mahala normalization
    def replace_mahala(match):
        num = match.group(2)
        return f"ਮਹਲਾ {mahala_map.get(num, num)}"
    text = re.sub(r"(ਮਹਲਾ|ਮ:|ਮਃ)\s*([੧੨੩੪੫੯])", replace_mahala, text)

    # Ghar normalization
    def replace_ghar(match):
        num = match.group(1)
        return f"ਘਰ {ghar_map.get(num, num)}"
    text = re.sub(r"ਘਰੁ?\s*([੧-੯]|੧[੦-੭])", replace_ghar, text)

    # Remove danda
    text = text.replace("॥", "")

    # Remove Punjabi digits
    text = re.sub(r"[੦-੯]+", "", text)

    # Clean spaces
    text = re.sub(r"\s+", " ", text).strip()

    return text

# Apply normalization
cursor.execute("SELECT rowid, GurmukhiUni FROM Verse")
rows = cursor.fetchall()

for rowid, text in rows:
    new_text = normalize_text(text)
    cursor.execute(
        "UPDATE Verse SET GurmukhiUni = ? WHERE rowid = ?",
        (new_text, rowid)
    )

conn.commit()

# -----------------------------
# STEP 3: Read cleaned data
# -----------------------------
rows = cursor.execute(
    "SELECT rowid, ShabadID, GurmukhiUni FROM Verse ORDER BY rowid"
).fetchall()

conn.close()

# -----------------------------
# STEP 4: Group by Shabad
# -----------------------------
grouped = []
current_sid = None
current_words = []

for _, sid, text in rows:
    words = text.split() if text else []

    if current_sid is None:
        current_sid = sid
        current_words = words[:]
    elif sid == current_sid:
        current_words.extend(words)
    else:
        grouped.append((current_sid, current_words))
        current_sid = sid
        current_words = words[:]

if current_sid is not None:
    grouped.append((current_sid, current_words))

# -----------------------------
# STEP 5: Create sliding windows
# -----------------------------
windows = []

for sid, words in grouped:
    if len(words) < WINDOW_SIZE:
        continue

    for i in range(0, len(words) - WINDOW_SIZE + 1, STEP_SIZE):
        window_text = " ".join(words[i:i + WINDOW_SIZE])
        windows.append((sid, window_text))

# -----------------------------
# STEP 6: Save new DB
# -----------------------------
if os.path.exists(dst_db):
    os.remove(dst_db)

conn = sqlite3.connect(dst_db)
cur = conn.cursor()

cur.execute("""
CREATE TABLE Verse (
    ShabadID INTEGER,
    GurmukhiUni TEXT
)
""")

cur.executemany(
    "INSERT INTO Verse (ShabadID, GurmukhiUni) VALUES (?, ?)",
    windows
)

conn.commit()

# -----------------------------
# STEP 7: Summary
# -----------------------------
count = cur.execute("SELECT COUNT(*) FROM Verse").fetchone()[0]
sample = cur.execute("SELECT * FROM Verse LIMIT 5").fetchall()

conn.close()

print("Final DB:", dst_db)
print("Total windows:", count)
print("Sample rows:", sample)