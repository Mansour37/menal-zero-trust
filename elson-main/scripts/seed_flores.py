"""
Download FLORES-200 dev+devtest sentences for Arabic, French, English
and generate SQL INSERT statements for the crowdsource database.

FLORES-200: A high-quality parallel translation dataset with 3001 sentences
covering diverse topics (news, Wikipedia, everyday situations) 
in 200+ languages — perfect for low-resource language training.

Output: seed_flores.sql with INSERT statements
"""
import json
import urllib.request
import sys

LANGS = {
    "ara_Arab": "ar",  # Arabic
    "fra_Latn": "fr",  # French
    "eng_Latn": "en",  # English
}

BASE_URL = "https://datasets-server.huggingface.co/rows?dataset=facebook/flores&config=all&split={split}&offset={offset}&length={length}"

def fetch_split(split: str, max_rows: int = 1000):
    """Fetch rows from a FLORES-200 split via HF datasets API."""
    rows = []
    offset = 0
    batch = 100
    while offset < max_rows:
        url = BASE_URL.format(split=split, offset=offset, length=min(batch, max_rows - offset))
        print(f"  Fetching {split} offset={offset}...", file=sys.stderr)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                new_rows = data.get("rows", [])
                if not new_rows:
                    break
                rows.extend(new_rows)
                offset += len(new_rows)
        except Exception as e:
            print(f"  Error at offset {offset}: {e}", file=sys.stderr)
            break
    return rows

def main():
    print("Fetching FLORES-200 data...", file=sys.stderr)
    
    # Try both splits
    all_rows = []
    for split in ["dev", "devtest"]:
        rows = fetch_split(split, max_rows=1012)
        all_rows.extend(rows)
        print(f"  Got {len(rows)} rows from {split}", file=sys.stderr)

    if not all_rows:
        print("ERROR: No data fetched. Trying alternative approach...", file=sys.stderr)
        return

    # Extract trilingual parallel sentences
    # Each row has: id, sentence, url, domain, topic, has_image, has_hyperlink
    # But actually FLORES on HF has one row per sentence with all translations
    # Let's check the structure first
    sample = all_rows[0]
    print(f"\n  Sample row keys: {list(sample.get('row', {}).keys())[:20]}", file=sys.stderr)
    
    # Generate SQL
    sql_lines = []
    sql_lines.append("-- FLORES-200 parallel sentences (EN/FR/AR)")
    sql_lines.append("-- Source: facebook/flores-200 dataset")
    sql_lines.append("-- Categories: news, Wikipedia, everyday situations")
    sql_lines.append("")
    
    count = 0
    for row_wrapper in all_rows:
        row = row_wrapper.get("row", row_wrapper)
        
        # Try different possible column name formats
        en = row.get("sentence_eng_Latn", row.get("eng_Latn", ""))
        fr = row.get("sentence_fra_Latn", row.get("fra_Latn", ""))
        ar = row.get("sentence_ara_Arab", row.get("ara_Arab", ""))
        
        if not en or not fr or not ar:
            continue
            
        # Skip very long sentences (>300 chars) - not good for crowdsource
        if len(en) > 300 or len(fr) > 300 or len(ar) > 300:
            continue
        
        # Escape single quotes for SQL
        en_esc = en.replace("'", "''")
        fr_esc = fr.replace("'", "''")
        ar_esc = ar.replace("'", "''")
        
        group_ref = f"flores_{count + 1:04d}"
        
        sql_lines.append(f"INSERT INTO phrases (source_text, source_lang, hassaniya_reference, origin, is_active, difficulty, times_contributed) VALUES ('{en_esc}', 'en', '{group_ref}', 'flores-200', true, 1, 0);")
        sql_lines.append(f"INSERT INTO phrases (source_text, source_lang, hassaniya_reference, origin, is_active, difficulty, times_contributed) VALUES ('{fr_esc}', 'fr', '{group_ref}', 'flores-200', true, 1, 0);")
        sql_lines.append(f"INSERT INTO phrases (source_text, source_lang, hassaniya_reference, origin, is_active, difficulty, times_contributed) VALUES ('{ar_esc}', 'ar', '{group_ref}', 'flores-200', true, 1, 0);")
        sql_lines.append("")
        count += 1
    
    print(f"\n  Generated {count} trilingual phrase groups", file=sys.stderr)
    
    # Write to file
    output_path = r"C:\Users\mohamed.beydia\Downloads\hassaniya llm\crowdsource\scripts\seed_flores.sql"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    
    print(f"  SQL written to: {output_path}", file=sys.stderr)

if __name__ == "__main__":
    main()
