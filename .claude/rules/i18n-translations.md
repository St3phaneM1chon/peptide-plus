# i18n Translation Rules

## STRICT: Every Text Must Be Translated
- ALL user-facing text MUST go through `t('key')` - NO exceptions
- French (fr.json) is the REFERENCE language
- ANY change to text content MUST update ALL 22 locale files
- Even moving a comma requires updating all translations

## Before Adding a Component
1. Define ALL translation keys needed
2. Add keys to `en.json` and `fr.json` FIRST
3. Add English fallback to all 20 other locale files
4. THEN write the component using `t()` calls

## Translation Key Naming
- Use dot notation: `namespace.section.key`
- Namespaces: `shop`, `account`, `admin`, `auth`, `cart`, `checkout`, `common`, `nav`, `footer`, etc.
- Keep keys descriptive: `account.invoices.downloadPdf` not `account.dlPdf`
- Plurals: use singular and plural keys: `item`/`items`

## Forbidden Patterns
- ❌ `<p>Some hardcoded text</p>`
- ❌ `placeholder="Search..."` (use `placeholder={t('common.search')}`)
- ❌ `title="Settings"` (use `title={t('nav.settings')}`)
- ✅ `<p>{t('page.description')}</p>`
- ✅ `placeholder={t('common.search')}`

## Hook Usage
- Prefer `useTranslations()` from `src/hooks/useTranslations.ts` (standalone)
- `useI18n()` from `src/i18n/client.tsx` requires `I18nProvider` context
- Both expose `t()` function and `locale` string

## Locale Files Structure
- Location: `src/i18n/locales/{locale}.json`
- 22 locales: en, fr, ar, ar-dz, ar-lb, ar-ma, de, es, gcr, hi, ht, it, ko, pa, pl, pt, ru, sv, ta, tl, vi, zh
- en.json and fr.json are reference (must have ALL keys)
- Other locales fall back to English via the hook
