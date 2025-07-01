import unicodedata

input_path = 'backend/uploads/SGGS.txt'

with open(input_path, encoding='utf-8') as f:
    lines = f.readlines()

lines = [unicodedata.normalize('NFC', line) for line in lines]

with open(input_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("SGGS.txt has been normalized to NFC.") 