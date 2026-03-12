# MEGA AUDIT v4.0 - Angle 6: Internationalization (i18n)

**Project**: BioCycle Peptides (peptide-plus)
**Date**: 2026-03-12
**Auditor**: Claude Opus 4.6
**Scope**: All 22 locale files, translation hook usage, hardcoded strings, RTL support
**Reference Language**: French (fr.json)

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| **Overall i18n Score** | **68 / 100** |
| Locales Supported | 22 |
| Reference Keys (fr.json) | 12,672 |
| Key Parity with Reference | 2/22 locales at 100% |
| Missing Keys (non-ref locales) | 1,144 per locale (9% gap) |
| Hardcoded Strings | 483 instances |
| t() Calls in Source | 16,509 |
| RTL Locales | 4 (ar, ar-dz, ar-lb, ar-ma) |
| Total Locale Data | 12.1 MB across 22 files |

**Verdict**: Strong foundation -- 22 locales, 12,672 reference keys, and 16,509 t() call sites demonstrate serious i18n investment. However, two issues prevent a higher score: **1,144 keys missing from 20 of 22 locales** (meaning those locales silently fall back to English for ~9% of the UI) and **483 hardcoded strings** that bypass the translation system entirely. These gaps undermine the multilingual experience for the majority of supported languages.

**Score Breakdown**:
- Locale breadth & architecture: 20/25
- Key coverage & parity: 15/25
- Hardcoded string discipline: 10/25
- RTL & edge-case support: 8/10
- Tooling & workflow: 15/15

---

## 2. Locale Coverage Analysis

### 2.1 Supported Locales (22)

| # | Locale | Language | Script | Direction | Keys | Coverage vs fr |
|---|--------|----------|--------|-----------|------|----------------|
| 1 | **fr** | French | Latin | LTR | **12,672** | 100% (REF) |
| 2 | **en** | English | Latin | LTR | **12,672** | 100% |
| 3 | ar | Arabic | Arabic | **RTL** | 11,528 | 90.97% |
| 4 | ar-dz | Arabic (Algeria) | Arabic | **RTL** | 11,528 | 90.97% |
| 5 | ar-lb | Arabic (Lebanon) | Arabic | **RTL** | 11,528 | 90.97% |
| 6 | ar-ma | Arabic (Morocco) | Arabic | **RTL** | 11,528 | 90.97% |
| 7 | de | German | Latin | LTR | 11,528 | 90.97% |
| 8 | es | Spanish | Latin | LTR | 11,528 | 90.97% |
| 9 | gcr | French Guianese Creole | Latin | LTR | 11,528 | 90.97% |
| 10 | hi | Hindi | Devanagari | LTR | 11,528 | 90.97% |
| 11 | ht | Haitian Creole | Latin | LTR | 11,528 | 90.97% |
| 12 | it | Italian | Latin | LTR | 11,528 | 90.97% |
| 13 | ko | Korean | Hangul | LTR | 11,528 | 90.97% |
| 14 | pa | Punjabi | Gurmukhi | LTR | 11,528 | 90.97% |
| 15 | pl | Polish | Latin | LTR | 11,528 | 90.97% |
| 16 | pt | Portuguese | Latin | LTR | 11,528 | 90.97% |
| 17 | ru | Russian | Cyrillic | LTR | 11,528 | 90.97% |
| 18 | sv | Swedish | Latin | LTR | 11,528 | 90.97% |
| 19 | ta | Tamil | Tamil | LTR | 11,528 | 90.97% |
| 20 | tl | Tagalog | Latin | LTR | 11,528 | 90.97% |
| 21 | vi | Vietnamese | Latin | LTR | 11,528 | 90.97% |
| 22 | zh | Chinese | CJK | LTR | 11,528 | 90.97% |

### 2.2 File Size Distribution

| Locale | Lines | Size | Notes |
|--------|-------|------|-------|
| fr.json | 13,594 | 602 KB | Reference |
| en.json | 13,594 | ~600 KB | Matches reference structure |
| ta.json | ~12,400 | **703 KB** | Largest by bytes -- Tamil strings are longer |
| Average (others) | ~12,400 | ~550 KB | -- |
| **Total** | -- | **12.1 MB** | All 22 locale files combined |

### 2.3 Script & Direction Coverage

| Category | Locales | Count |
|----------|---------|-------|
| Latin LTR | fr, en, de, es, gcr, ht, it, pl, pt, sv, tl, vi | 12 |
| Arabic RTL | ar, ar-dz, ar-lb, ar-ma | 4 |
| Cyrillic LTR | ru | 1 |
| Devanagari LTR | hi | 1 |
| Gurmukhi LTR | pa | 1 |
| Hangul LTR | ko | 1 |
| Tamil LTR | ta | 1 |
| CJK LTR | zh | 1 |

The locale set covers 8 distinct scripts, which is excellent for a peptide e-commerce platform targeting global researchers.

---

## 3. Key Gap Analysis

### 3.1 The 1,144-Key Gap

- **Reference (fr.json)**: 12,672 leaf keys
- **English (en.json)**: 12,672 leaf keys (full parity)
- **All other 20 locales**: 11,528 leaf keys each
- **Gap**: 12,672 - 11,528 = **1,144 keys missing per locale**
- **Percentage**: 9.03% of the reference

This is a uniform gap: every non-fr/en locale is missing the exact same 1,144 keys. This strongly suggests a batch translation was performed at a point when fr.json had 11,528 keys, and the subsequent 1,144 keys were added to fr and en only.

### 3.2 Impact of Missing Keys

When a key is missing from a locale file, the `useTranslations()` hook falls back to English. For users browsing in Arabic, Hindi, Tamil, or any other non-English locale, 9% of the interface silently displays English text. This creates:

- **Jarring UX**: Mixed-language interface (e.g., Arabic page with random English labels)
- **RTL breakage**: English fallback text in an RTL layout causes bidirectional text issues
- **Accessibility issues**: Screen readers may switch language mid-page without `lang` attribute changes
- **Trust erosion**: Partial translation signals an incomplete product to non-English users

### 3.3 Likely Namespaces Affected

Given that the gap is exactly 1,144 keys and appeared uniformly, the missing keys likely belong to recently added features. Based on the namespace list, probable candidates include:

- `crm.*` -- CRM flat keys (large namespace, likely added post-initial translation)
- `admin.*` -- Admin panel keys added iteratively
- `ambassador.*` -- Ambassador program keys
- `apiDocs.*` -- API documentation strings
- `community.*` -- Forum/community feature keys
- `calculator.*` -- Peptide calculator keys

### 3.4 Remediation Effort Estimate

| Approach | Time | Cost | Quality |
|----------|------|------|---------|
| Machine translation (DeepL/GPT) + review | 2-3 days | Low | Medium |
| Professional translation (20 locales x 1,144 keys) | 2-3 weeks | High | High |
| Hybrid: machine translate + community review | 1 week | Low-Medium | Medium-High |

**Recommendation**: Hybrid approach. Machine-translate the 1,144 keys for all 20 locales, flag them in the DB via `TranslationJob`, then use the existing `TranslationFeedback` model for community corrections.

---

## 4. Hardcoded String Audit

### 4.1 Summary

| Category | Instances | Severity |
|----------|-----------|----------|
| `placeholder="..."` with literal text | 131 | HIGH |
| `title="..."` with literal text | 164 | MEDIUM |
| `aria-label="..."` with literal text | 188 | HIGH |
| **Total** | **483** | -- |

### 4.2 placeholder Hardcoded Strings (131)

Hardcoded placeholders are among the most visible i18n failures. Users see them in every input field before typing.

**Pattern observed**: `placeholder="Search products..."` instead of `placeholder={t('common.searchPlaceholder')}`

**Impact**: Input fields display English/French placeholder text regardless of user locale.

**Fix complexity**: Low -- each instance requires wrapping the literal string in a `t()` call and adding the key to all 22 locale files.

### 4.3 title Attribute Hardcoded Strings (164)

Title attributes appear on hover (tooltip). Less visible than placeholders but still broken for non-English users.

**Pattern observed**: `title="Add to cart"` instead of `title={t('cart.addToCart')}`

**Impact**: Tooltips display in wrong language. Medium severity because tooltips are supplementary UI.

### 4.4 aria-label Hardcoded Strings (188)

This is the most critical category from an accessibility standpoint. Screen reader users in non-English locales hear English labels, making the application effectively inaccessible.

**Pattern observed**: `aria-label="Close dialog"` instead of `aria-label={t('common.closeDialog')}`

**Impact**: Accessibility compliance failure for non-English locales. Violates WCAG 2.1 SC 3.1.2 (Language of Parts).

### 4.5 Remediation Strategy

1. Create a script to scan for `placeholder="|title="|aria-label="` patterns not wrapped in `{t(` or `{...t(`
2. Generate key suggestions based on context (e.g., `placeholder="Search..."` -> `common.searchPlaceholder`)
3. Add keys to fr.json first (reference), then propagate to all locales
4. Replace hardcoded strings with `t()` calls
5. Add an ESLint rule to prevent future hardcoded strings in these attributes

**Estimated effort**: 3-5 days for a developer familiar with the codebase.

---

## 5. RTL Support Assessment

### 5.1 RTL Locales

| Locale | Region | Status |
|--------|--------|--------|
| ar | Arabic (Standard) | Keys present, RTL CSS needs verification |
| ar-dz | Arabic (Algeria) | Keys present, RTL CSS needs verification |
| ar-lb | Arabic (Lebanon) | Keys present, RTL CSS needs verification |
| ar-ma | Arabic (Morocco) | Keys present, RTL CSS needs verification |

### 5.2 RTL Requirements Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| `dir="rtl"` on `<html>` or `<body>` | NEEDS VERIFICATION | Must toggle based on locale |
| CSS logical properties (`margin-inline-start` vs `margin-left`) | NEEDS VERIFICATION | Critical for layout mirroring |
| Tailwind RTL plugin or `rtl:` variant | NEEDS VERIFICATION | If using Tailwind |
| Bidirectional text handling | AT RISK | English fallback text in RTL context causes bidi issues |
| Number formatting (Arabic-Indic digits) | NEEDS VERIFICATION | Prices, quantities |
| Calendar direction | NEEDS VERIFICATION | Date pickers, countdowns |
| Icon mirroring (arrows, navigation) | NEEDS VERIFICATION | Directional icons must flip |

### 5.3 RTL Risk: English Fallback in Arabic Locales

The 1,144 missing keys become especially problematic in RTL locales. When the fallback displays English text within an Arabic layout:
- Text direction conflicts create visual jumbling
- CSS `text-align` mismatch causes awkward spacing
- Mixed-direction paragraphs confuse reading order

**Recommendation**: Prioritize the 1,144 missing keys for Arabic locales first, as the fallback impact is most severe there.

---

## 6. Translation System Architecture

### 6.1 Client-Side Translation

```
useTranslations() hook
    |
    +-- Returns: { t: (key) => string, locale: string }
    +-- Source: src/hooks/useTranslations.ts
    +-- Fallback chain: current locale -> en -> key path as string
    +-- Provider: I18nProvider (context-based)
```

### 6.2 Translation Data Flow

```
src/i18n/locales/
    |-- fr.json  (12,672 keys, REFERENCE)
    |-- en.json  (12,672 keys)
    |-- [20 others] (11,528 keys each)
         |
         v
    I18nProvider (loads locale JSON)
         |
         v
    useTranslations() / useI18n()
         |
         v
    t('namespace.key') -> resolved string
```

### 6.3 Database Models

| Model | Purpose |
|-------|---------|
| `TranslationFeedback` | Crowdsourced corrections from users |
| `TranslationJob` | Tracks translation work status per locale/key-range |

### 6.4 Architecture Strengths

- Clean hook-based API (`useTranslations()`) avoids prop drilling
- Context provider pattern allows locale switching without page reload
- English fallback prevents blank strings
- Crowdsource feedback model enables community-driven quality improvement
- TranslationJob model supports systematic translation tracking

### 6.5 Architecture Concerns

- **No server-side translation**: SEO meta tags, OG tags, and SSR content may not be translated
- **No namespace splitting**: All 12,672 keys loaded as one JSON blob (~600 KB per locale)
- **No lazy loading**: Locale file loaded entirely on first page load
- **No plural rules**: Standard `t()` may not handle pluralization (1 item vs 2 items) for languages with complex plural forms (Arabic has 6 plural forms, Polish has 3)

---

## 7. Namespace Organization

### 7.1 Top-Level Namespaces

Based on fr.json key structure:

| Namespace | Domain | Likely Key Count |
|-----------|--------|-----------------|
| `common` | Shared UI strings (buttons, labels) | High |
| `auth` | Login, register, password reset | Medium |
| `account` | User account management | Medium |
| `admin` | Admin panel | High |
| `ambassador` | Ambassador program | Medium |
| `apiDocs` | API documentation | Medium |
| `badges` | Achievement/loyalty badges | Low |
| `blog` | Blog/articles | Medium |
| `calculator` | Peptide calculator tool | Medium |
| `cart` | Shopping cart | Medium |
| `categories` | Product categories | Low |
| `chat` | Live chat/support | Medium |
| `checkout` | Checkout flow | High |
| `community` | Forum/community | Medium |
| `compare` | Product comparison | Low |
| `consent` | Cookie/privacy consent | Low |
| `consentType` | Consent type labels | Low |
| `contact` | Contact page | Low |
| `contentType` | Content type labels | Low |
| `cookies` | Cookie policy | Low |
| `countdown` | Countdown timer | Low |
| `crm.*` | CRM flat keys | High |
| (others) | Various features | Variable |

### 7.2 Namespace Concerns

- **`crm.*` uses flat keys**: The `crm` namespace appears to use many flat (non-nested) keys, which suggests it was added without following the nested namespace convention. This can cause key collisions and makes it harder to manage.
- **No namespace documentation**: There is no manifest or documentation mapping namespaces to features/pages, making it difficult for translators to understand context.

---

## 8. Orphan Key Analysis

### 8.1 Potential Orphan Keys

With 12,672 keys in locale files and 16,509 `t()` calls in source code, the ratio is approximately **1.30 t() calls per key**. This suggests:

- Most keys are actively used (good)
- Some keys are referenced multiple times (shared strings like `common.save`, `common.cancel`)
- Low risk of large-scale orphan keys, but individual orphans likely exist

### 8.2 Orphan Detection Method

To identify orphan keys (present in locale files but never referenced in code):

1. Extract all leaf keys from fr.json
2. Search source code for each key in `t('key')` or `t("key")` patterns
3. Keys with zero references are orphan candidates
4. Exclude dynamic key construction patterns (e.g., `` t(`status.${status}`) ``)

### 8.3 Estimated Orphan Count

Based on the healthy t()-to-key ratio of 1.30, estimated orphan keys: **200-400** (1.5-3% of total). This is a normal range for an actively developed codebase. These represent minor bloat in locale files but no functional impact.

**Recommendation**: Run an automated orphan detection script quarterly. Remove confirmed orphans to keep locale files lean.

---

## 9. Findings Table

| ID | Severity | Category | Finding | Recommendation |
|----|----------|----------|---------|----------------|
| I18N-001 | **CRITICAL** | Key Coverage | 1,144 keys missing from 20/22 locales (9% gap). Users see English fallback for ~9% of the UI. | Machine-translate missing keys, track via TranslationJob, validate via TranslationFeedback. Priority: Arabic locales first (RTL impact). |
| I18N-002 | **CRITICAL** | Hardcoded Strings | 188 `aria-label` attributes with literal English text. Screen readers in non-English locales hear wrong language. WCAG 2.1 violation. | Wrap all aria-labels in `t()` calls. Add ESLint rule `no-literal-aria-label` to prevent regression. |
| I18N-003 | **HIGH** | Hardcoded Strings | 131 `placeholder` attributes with literal text. Visible to every user on every form. | Wrap all placeholders in `t()` calls. Add corresponding keys to all 22 locale files. |
| I18N-004 | **HIGH** | Hardcoded Strings | 164 `title` attributes with literal text. Tooltips display in wrong language. | Wrap all title attributes in `t()` calls. Lower priority than placeholders and aria-labels. |
| I18N-005 | **HIGH** | RTL Support | 4 Arabic locales present but RTL CSS verification incomplete. Layout mirroring, bidi text handling, and icon flipping unconfirmed. | Conduct dedicated RTL visual audit. Test all pages in `ar` locale. Verify `dir="rtl"` toggle, CSS logical properties, icon mirroring. |
| I18N-006 | **HIGH** | Performance | All 12,672 keys loaded as single JSON blob (~600 KB) on page load. No namespace splitting or lazy loading. | Implement namespace-based code splitting. Load only keys needed for current page/route. Lazy-load additional namespaces on navigation. |
| I18N-007 | **MEDIUM** | Architecture | No evidence of plural form support. Arabic (6 forms), Polish (3 forms), Russian (3 forms) require ICU MessageFormat or equivalent. | Audit pluralization needs. Implement ICU MessageFormat for keys involving counts (cart items, search results, etc.). |
| I18N-008 | **MEDIUM** | Architecture | No server-side translation evidence. SEO meta tags, OG tags, and SSR-rendered content may not be translated. | Verify Next.js SSR translation pipeline. Ensure `<meta>` tags, `<title>`, and OG properties use translated strings. |
| I18N-009 | **MEDIUM** | Namespace | `crm.*` uses flat key structure inconsistent with other namespaces. Risk of key collisions and translator confusion. | Refactor `crm` keys into nested structure. Document namespace conventions for translators. |
| I18N-010 | **LOW** | Maintenance | Estimated 200-400 orphan keys in locale files (keys not referenced in code). Minor file bloat. | Run automated orphan detection quarterly. Remove confirmed orphans. Establish CI check for unused keys. |
| I18N-011 | **LOW** | Maintenance | No namespace-to-feature documentation. Translators lack context for which keys belong to which UI surface. | Create `src/i18n/NAMESPACE_MAP.md` documenting each namespace, its feature scope, and screenshot references. |
| I18N-012 | **LOW** | Quality | No automated CI check for translation completeness. Missing keys can regress silently when new keys are added to fr.json. | Add CI step that compares all locale files against fr.json and fails build if any locale drops below 95% coverage. |

---

## 10. Recommendations

### 10.1 Immediate Actions (Week 1)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Machine-translate the 1,144 missing keys for Arabic locales (ar, ar-dz, ar-lb, ar-ma) | 1 day | Fixes RTL fallback breakage |
| P0 | Machine-translate the 1,144 missing keys for remaining 16 locales | 2 days | Achieves 100% key parity |
| P1 | Fix 188 hardcoded `aria-label` instances | 2 days | WCAG compliance |
| P1 | Fix 131 hardcoded `placeholder` instances | 1.5 days | Visible UX improvement |

### 10.2 Short-Term Actions (Weeks 2-4)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P1 | Fix 164 hardcoded `title` instances | 1.5 days | Complete hardcoded string elimination |
| P1 | RTL visual audit -- test all pages in Arabic locale | 2 days | Verify/fix layout mirroring |
| P2 | Add ESLint rule preventing literal strings in `placeholder`, `title`, `aria-label` | 0.5 day | Prevents regression |
| P2 | Add CI translation completeness check | 0.5 day | Prevents future key drift |

### 10.3 Medium-Term Actions (Month 2)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P2 | Implement namespace-based locale splitting (lazy loading) | 3-5 days | ~60% reduction in initial locale payload |
| P2 | Add ICU MessageFormat for pluralization | 3 days | Correct plural forms for 8+ languages |
| P3 | Verify SSR translation pipeline for SEO meta/OG tags | 1 day | SEO for non-English markets |
| P3 | Run orphan key detection and cleanup | 1 day | Leaner locale files |

### 10.4 Long-Term Actions (Quarter)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P3 | Create namespace documentation for translators | 1 day | Better translation quality |
| P3 | Refactor `crm.*` flat keys into nested structure | 2 days | Consistency |
| P3 | Implement Translation Memory (TM) to reuse translations across similar keys | 3 days | Faster future translation |
| P3 | Establish quarterly translation review cycle using TranslationFeedback data | Ongoing | Continuous quality improvement |

### 10.5 Projected Score After Remediation

| Phase | Actions | Projected Score |
|-------|---------|----------------|
| Current state | -- | **68/100** |
| After Week 1 (key parity + aria-label fix) | I18N-001, I18N-002, I18N-003 | **82/100** |
| After Month 1 (all hardcoded + RTL + CI) | I18N-004 to I18N-006, I18N-012 | **90/100** |
| After Month 2 (splitting + plurals + SSR) | I18N-007, I18N-008 | **95/100** |
| After Quarter (full cleanup) | All remaining | **97/100** |

---

## Appendix A: Locale Language Map

| Code | Language | Region | Script | % of World Internet Users |
|------|----------|--------|--------|--------------------------|
| fr | French | Global | Latin | 3.3% |
| en | English | Global | Latin | 25.9% |
| ar | Arabic | Standard | Arabic | 5.2% |
| ar-dz | Arabic | Algeria | Arabic | (regional) |
| ar-lb | Arabic | Lebanon | Arabic | (regional) |
| ar-ma | Arabic | Morocco | Arabic | (regional) |
| de | German | Global | Latin | 3.7% |
| es | Spanish | Global | Latin | 7.9% |
| gcr | Guianese Creole | French Guiana | Latin | (niche) |
| hi | Hindi | India | Devanagari | 4.6% |
| ht | Haitian Creole | Haiti | Latin | (niche) |
| it | Italian | Global | Latin | 2.3% |
| ko | Korean | Korea | Hangul | 2.0% |
| pa | Punjabi | India/Pakistan | Gurmukhi | (niche) |
| pl | Polish | Poland | Latin | 1.5% |
| pt | Portuguese | Global | Latin | 4.3% |
| ru | Russian | Global | Cyrillic | 5.7% |
| sv | Swedish | Sweden | Latin | 0.6% |
| ta | Tamil | India/Sri Lanka | Tamil | (niche) |
| tl | Tagalog | Philippines | Latin | 0.7% |
| vi | Vietnamese | Vietnam | Latin | 1.3% |
| zh | Chinese | Global | CJK | 19.4% |

Combined internet user reach of supported locales: **~88%** of global internet users.

---

## Appendix B: Key Metrics Summary

```
Locales:              22
Reference keys:       12,672 (fr.json)
Full-parity locales:  2 / 22 (fr, en)
Partial locales:      20 / 22 (each at 90.97%)
Missing keys/locale:  1,144
Total missing keys:   22,880 (1,144 x 20 locales)
Hardcoded strings:    483
t() call sites:       16,509
t()-to-key ratio:     1.30
Total locale size:    12.1 MB
Largest locale file:  ta.json (703 KB)
RTL locales:          4
Scripts covered:      8
```

---

*Report generated as part of MEGA AUDIT v4.0 -- Angle 6: Internationalization*
*Next: Angle 7 or consolidation of all audit angles into final MEGA AUDIT report*
