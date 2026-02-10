/**
 * Script to update all translation files with missing keys from English
 * Run with: node scripts/update-translations.js
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');

// Load English as the master
const enPath = path.join(localesDir, 'en.json');
const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

// Get all locale files
const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');

// Deep merge function - adds missing keys from source to target
function addMissingKeys(target, source, langCode) {
  const result = { ...target };
  
  for (const key in source) {
    if (!(key in result)) {
      // Key is completely missing - add it
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = addMissingKeys({}, source[key], langCode);
      } else {
        result[key] = source[key]; // Use English as fallback
      }
    } else if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
      // Recursively check nested objects
      result[key] = addMissingKeys(result[key] || {}, source[key], langCode);
    }
  }
  
  return result;
}

// Process each locale file
let updatedCount = 0;
localeFiles.forEach(file => {
  const filePath = path.join(localesDir, file);
  const langCode = file.replace('.json', '');
  
  try {
    const translations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const updated = addMissingKeys(translations, enTranslations, langCode);
    
    // Check if anything changed
    const originalStr = JSON.stringify(translations, null, 2);
    const updatedStr = JSON.stringify(updated, null, 2);
    
    if (originalStr !== updatedStr) {
      fs.writeFileSync(filePath, updatedStr);
      console.log(`✓ Updated: ${file}`);
      updatedCount++;
    } else {
      console.log(`- No changes: ${file}`);
    }
  } catch (err) {
    console.error(`✗ Error processing ${file}:`, err.message);
  }
});

console.log(`\nDone! Updated ${updatedCount} files.`);
console.log('Note: Missing translations will show English text until properly translated.');
