#!/usr/bin/env python3
"""
One-shot translation of all UI locale files using GPT-4o-mini.
Translates keys that are missing or still in English fallback.

Usage:
  python3 scripts/translate-locales.py                    # All 20 languages
  python3 scripts/translate-locales.py --lang de es fr    # Specific languages
  python3 scripts/translate-locales.py --dry-run           # Preview only
  python3 scripts/translate-locales.py --lang de --batch-size 50  # Smaller batches
"""

import json
import os
import sys
import time
import argparse
import asyncio
from pathlib import Path
from copy import deepcopy

# Add project root for .env loading
PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = PROJECT_ROOT / "src" / "i18n" / "locales"

# Language names for GPT prompts
LANGUAGE_NAMES = {
    "ar": "Arabic (Standard)",
    "ar-dz": "Arabic (Algerian dialect)",
    "ar-lb": "Arabic (Lebanese dialect)",
    "ar-ma": "Arabic (Moroccan dialect)",
    "de": "German",
    "es": "Spanish",
    "gcr": "Guianese Creole (Creole guyanais)",
    "hi": "Hindi",
    "ht": "Haitian Creole",
    "it": "Italian",
    "ko": "Korean",
    "pa": "Punjabi",
    "pl": "Polish",
    "pt": "Portuguese (Brazilian)",
    "ru": "Russian",
    "sv": "Swedish",
    "ta": "Tamil",
    "tl": "Filipino/Tagalog",
    "vi": "Vietnamese",
    "zh": "Chinese (Simplified)",
}

# Keys/values to NEVER translate (brand names, scientific terms)
SKIP_PATTERNS = [
    "BioCycle Peptides",
    "BPC-157", "TB-500", "CJC-1295", "GHRP-6", "GHRP-2",
    "NAD+", "PT-141", "GHK-Cu", "AOD-9604", "LL-37", "KPV",
    "HPLC", "COA", "GMP", "ISO",
]

# Skip very short values that are often the same across languages
MIN_VALUE_LENGTH = 4


def flatten_json(d, prefix=""):
    """Flatten nested dict to dot-notation keys."""
    items = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(flatten_json(v, key))
        else:
            items[key] = v
    return items


def unflatten_json(flat_dict):
    """Convert dot-notation keys back to nested dict."""
    result = {}
    for key, value in sorted(flat_dict.items()):
        parts = key.split(".")
        d = result
        for part in parts[:-1]:
            if part not in d:
                d[part] = {}
            d = d[part]
        d[parts[-1]] = value
    return result


def deep_merge(base, override):
    """Recursively merge override into base."""
    result = deepcopy(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def find_untranslated_keys(en_flat, locale_flat):
    """Find keys that need translation (missing or identical to English)."""
    to_translate = {}

    for key, en_value in en_flat.items():
        if not isinstance(en_value, str):
            continue
        if len(en_value) < MIN_VALUE_LENGTH:
            continue
        # Skip if value is a brand/scientific term only
        if en_value.strip() in SKIP_PATTERNS:
            continue

        locale_value = locale_flat.get(key)

        # Missing key
        if locale_value is None:
            to_translate[key] = en_value
        # Identical to English (likely untranslated fallback)
        elif locale_value == en_value:
            to_translate[key] = en_value

    return to_translate


def batch_keys(keys_dict, batch_size=80):
    """Split dict into batches."""
    items = list(keys_dict.items())
    for i in range(0, len(items), batch_size):
        yield dict(items[i:i + batch_size])


async def translate_batch(client, batch, target_lang, lang_code):
    """Translate a batch of key-value pairs using GPT-4o-mini."""
    # Build the source JSON
    source_json = json.dumps(batch, ensure_ascii=False, indent=2)

    system_prompt = f"""You are a professional translator for a peptide e-commerce website (BioCycle Peptides).
Translate the following JSON values from English to {target_lang}.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanation, no code fences
2. Keep ALL JSON keys exactly the same (do not translate keys)
3. Preserve {{placeholders}} like {{amount}}, {{name}}, {{count}} exactly
4. Preserve HTML tags like <strong>, <br/> exactly
5. NEVER translate: peptide names (BPC-157, TB-500, etc.), brand "BioCycle Peptides", scientific terms (HPLC, COA, GMP)
6. Keep the same tone: professional but accessible
7. For {lang_code} specifically, use natural, idiomatic expressions"""

    user_prompt = source_json

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=16000,
                response_format={"type": "json_object"},
            )

            result_text = response.choices[0].message.content.strip()
            # Parse JSON response
            translated = json.loads(result_text)

            # Validate: all keys should be present
            missing = set(batch.keys()) - set(translated.keys())
            if missing:
                print(f"    Warning: {len(missing)} keys missing from response, keeping English")
                for k in missing:
                    translated[k] = batch[k]

            return translated, response.usage.total_tokens

        except json.JSONDecodeError as e:
            if attempt < max_retries - 1:
                print(f"    JSON parse error (attempt {attempt + 1}), retrying...")
                await asyncio.sleep(2 ** attempt)
            else:
                print(f"    Failed to parse JSON after {max_retries} attempts: {e}")
                return batch, 0  # Return original English

        except Exception as e:
            if attempt < max_retries - 1:
                print(f"    API error (attempt {attempt + 1}): {e}, retrying...")
                await asyncio.sleep(2 ** attempt)
            else:
                print(f"    Failed after {max_retries} attempts: {e}")
                return batch, 0


async def translate_locale(client, lang_code, en_flat, batch_size, dry_run):
    """Translate all missing/untranslated keys for a single locale."""
    lang_name = LANGUAGE_NAMES.get(lang_code, lang_code)
    locale_path = LOCALES_DIR / f"{lang_code}.json"

    if not locale_path.exists():
        print(f"  SKIP {lang_code}: file not found")
        return 0, 0

    with open(locale_path) as f:
        locale_data = json.load(f)

    locale_flat = flatten_json(locale_data)
    to_translate = find_untranslated_keys(en_flat, locale_flat)

    if not to_translate:
        print(f"  {lang_code} ({lang_name}): already fully translated!")
        return 0, 0

    print(f"  {lang_code} ({lang_name}): {len(to_translate)} keys to translate")

    if dry_run:
        return len(to_translate), 0

    # Process in batches
    batches = list(batch_keys(to_translate, batch_size))
    total_tokens = 0
    all_translated = {}

    for i, batch in enumerate(batches):
        print(f"    Batch {i + 1}/{len(batches)} ({len(batch)} keys)...", end="", flush=True)
        translated, tokens = await translate_batch(client, batch, lang_name, lang_code)
        all_translated.update(translated)
        total_tokens += tokens
        print(f" done ({tokens} tokens)")

        # Rate limiting: small delay between batches
        if i < len(batches) - 1:
            await asyncio.sleep(0.5)

    # Merge translations back into locale
    translated_nested = unflatten_json(all_translated)
    merged = deep_merge(locale_data, translated_nested)

    # Also add any keys from en.json that are completely missing
    en_data_full = unflatten_json(en_flat)
    for key in en_flat:
        if key not in locale_flat:
            # Key is missing entirely - use translated version if available, else English
            parts = key.split(".")
            d = merged
            add = True
            for part in parts[:-1]:
                if part not in d:
                    d[part] = {}
                if not isinstance(d[part], dict):
                    add = False
                    break
                d = d[part]
            if add and parts[-1] not in d:
                d[parts[-1]] = all_translated.get(key, en_flat[key])

    # Write back
    with open(locale_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"    -> {lang_code}.json updated ({len(all_translated)} translations)")
    return len(all_translated), total_tokens


async def main():
    parser = argparse.ArgumentParser(description="Translate locale JSON files")
    parser.add_argument("--lang", nargs="*", help="Specific language codes (default: all 20)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without translating")
    parser.add_argument("--batch-size", type=int, default=80, help="Keys per API call (default: 80)")
    parser.add_argument("--parallel", type=int, default=3, help="Parallel languages (default: 3)")
    args = parser.parse_args()

    # Load API key
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        # Try loading from .env
        env_path = PROJECT_ROOT / ".env"
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.strip().startswith("OPENAI_API_KEY"):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not api_key and not args.dry_run:
        print("ERROR: OPENAI_API_KEY not found")
        sys.exit(1)

    # Load English reference
    en_path = LOCALES_DIR / "en.json"
    with open(en_path) as f:
        en_data = json.load(f)
    en_flat = flatten_json(en_data)
    print(f"English reference: {len(en_flat)} keys\n")

    # Target languages
    target_langs = args.lang if args.lang else list(LANGUAGE_NAMES.keys())

    if args.dry_run:
        print("=== DRY RUN - No API calls ===\n")
        total_keys = 0
        for lang in target_langs:
            locale_path = LOCALES_DIR / f"{lang}.json"
            if not locale_path.exists():
                print(f"  SKIP {lang}: file not found")
                continue
            with open(locale_path) as f:
                locale_flat = flatten_json(json.load(f))
            to_translate = find_untranslated_keys(en_flat, locale_flat)
            lang_name = LANGUAGE_NAMES.get(lang, lang)
            print(f"  {lang} ({lang_name}): {len(to_translate)} keys to translate")
            total_keys += len(to_translate)
        print(f"\nTotal: {total_keys} translations across {len(target_langs)} languages")
        est_cost = (total_keys * 30 * 0.15 / 1_000_000) + (total_keys * 30 * 0.60 / 1_000_000)
        print(f"Estimated cost: ~${est_cost:.2f} (GPT-4o-mini)")
        return

    # Initialize OpenAI client
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)

    print(f"Translating {len(target_langs)} languages, batch size: {args.batch_size}, parallel: {args.parallel}\n")

    # Process languages with controlled parallelism
    semaphore = asyncio.Semaphore(args.parallel)
    total_translations = 0
    total_tokens = 0
    start_time = time.time()

    async def translate_with_semaphore(lang):
        async with semaphore:
            return await translate_locale(client, lang, en_flat, args.batch_size, False)

    tasks = [translate_with_semaphore(lang) for lang in target_langs]
    results = await asyncio.gather(*tasks)

    for translations, tokens in results:
        total_translations += translations
        total_tokens += tokens

    elapsed = time.time() - start_time
    est_cost = (total_tokens * 0.15 / 1_000_000) + (total_tokens * 0.60 / 1_000_000)

    print(f"\n{'=' * 50}")
    print(f"DONE in {elapsed:.0f}s")
    print(f"Total translations: {total_translations}")
    print(f"Total tokens: {total_tokens:,}")
    print(f"Estimated cost: ~${est_cost:.2f}")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    asyncio.run(main())
