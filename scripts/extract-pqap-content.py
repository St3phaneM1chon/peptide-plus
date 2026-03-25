#!/usr/bin/env python3
"""
Extract chapter content from PQAP manuals (PDF) for LMS lesson population.
Outputs JSON mapping: { manual: { chapter: text } }
"""
import subprocess
import json
import re
import sys
import os

MANUALS = {
    "F-111": {
        "path": "/Volumes/AI_Project/documents/formation assurance/Manuels/2-DeontoQC-F111-2024-11-Version-11ED - Copie - Copie.pdf",
        "title": "Déontologie et pratique professionnelle",
        "chapters": 4,
    },
    "F-312": {
        "path": "/Volumes/AI_Project/documents/formation assurance/Manuels/AccMaladie-F312-2024-11-10ED.pdf",
        "title": "Assurance contre les accidents et la maladie",
        "chapters": 8,
    },
    "F-311": {
        "path": "/Volumes/AI_Project/documents/formation assurance/Manuels/AssVie-F311-2025-11ED_R.pdf",
        "title": "Assurance vie",
        "chapters": 8,
    },
    "F-313": {
        "path": "/Volumes/AI_Project/documents/formation assurance/Manuels/FondsDistincts-F313-2024-10ED.pdf",
        "title": "Fonds distincts",
        "chapters": 8,
    },
}

def extract_pdf_text(path: str) -> str:
    """Extract text from PDF using pdftotext."""
    result = subprocess.run(
        ["pdftotext", "-layout", path, "-"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"Error extracting {path}: {result.stderr}", file=sys.stderr)
        return ""
    return result.stdout

def clean_text(text: str) -> str:
    """Clean extracted text: remove page numbers, headers/footers, extra whitespace."""
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Skip empty lines at start
        if not cleaned and not stripped:
            continue
        # Skip page number lines (just a number)
        if re.match(r'^\d+$', stripped):
            continue
        # Skip repeated chapter headers in footers (e.g., "Chapitre 1 – Cadre légal...")
        if re.match(r'^Chapitre \d+ [–-] .{20,}$', stripped):
            continue
        # Skip copyright lines
        if 'Autorité des marchés financiers' in stripped and len(stripped) < 100:
            continue
        # Skip edition lines
        if re.match(r'^Déontologie et pratique professionnelle \(Québec\)$', stripped):
            continue
        if re.match(r'^Assurance (vie|contre les accidents)', stripped) and len(stripped) < 60:
            continue
        if re.match(r'^Fonds distincts$', stripped):
            continue
        cleaned.append(line)

    text = '\n'.join(cleaned)
    # Collapse multiple blank lines to max 2
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    return text.strip()

def split_chapters(text: str, num_chapters: int) -> dict:
    """Split text into chapters using CHAPITRE N markers."""
    chapters = {}

    # Find all chapter start positions (looking for "CHAPITRE N" on its own line)
    pattern = re.compile(r'^CHAPITRE\s+(\d+)', re.MULTILINE)
    matches = list(pattern.finditer(text))

    if not matches:
        # Try alternate format
        pattern = re.compile(r'^Chapitre\s+(\d+)\s*$', re.MULTILINE)
        matches = list(pattern.finditer(text))

    if not matches:
        print(f"  WARNING: No chapter markers found", file=sys.stderr)
        chapters["1"] = text[:5000]  # Just take first 5K chars as fallback
        return chapters

    # Deduplicate: take only the FIRST occurrence of each chapter number
    seen = set()
    unique_matches = []
    for m in matches:
        chap_num = m.group(1)
        if chap_num not in seen:
            seen.add(chap_num)
            unique_matches.append(m)

    # Extract content between chapter markers
    for i, match in enumerate(unique_matches):
        chap_num = match.group(1)
        start = match.start()
        end = unique_matches[i + 1].start() if i + 1 < len(unique_matches) else len(text)

        chapter_text = text[start:end]
        chapter_text = clean_text(chapter_text)

        # Limit to ~8000 chars per chapter for manualText (readable in lesson)
        if len(chapter_text) > 8000:
            # Keep first 8000 chars, ending at last complete paragraph
            truncated = chapter_text[:8000]
            last_para = truncated.rfind('\n\n')
            if last_para > 4000:
                truncated = truncated[:last_para]
            chapter_text = truncated + "\n\n[... suite du chapitre dans le manuel complet]"

        chapters[chap_num] = chapter_text
        print(f"  Chapter {chap_num}: {len(chapter_text)} chars", file=sys.stderr)

    return chapters

def main():
    output = {}

    for manual_id, info in MANUALS.items():
        path = info["path"]
        if not os.path.exists(path):
            print(f"SKIP {manual_id}: file not found at {path}", file=sys.stderr)
            continue

        print(f"\nExtracting {manual_id} ({info['title']})...", file=sys.stderr)
        text = extract_pdf_text(path)
        if not text:
            continue

        print(f"  Total text: {len(text)} chars, {text.count(chr(10))} lines", file=sys.stderr)

        chapters = split_chapters(text, info["chapters"])

        output[manual_id] = {
            "title": info["title"],
            "chapters": chapters,
        }

    # Write output
    output_path = os.path.join(os.path.dirname(__file__), "pqap-manual-content.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nOutput: {output_path}", file=sys.stderr)

    # Summary
    total_chapters = sum(len(m["chapters"]) for m in output.values())
    total_chars = sum(
        len(ch) for m in output.values() for ch in m["chapters"].values()
    )
    print(f"Total: {total_chapters} chapters, {total_chars:,} chars", file=sys.stderr)

if __name__ == "__main__":
    main()
