# Multi-language Support (i18n Framework + Twi) — Design Spec

## Overview

Add an internationalization framework with a React Context provider, translation hook, and language switcher. Ship English + Twi translations. Framework supports adding Ewe, Dagbani, and other languages by adding JSON files — no code changes needed.

## Scope

**In scope:**
- LanguageContext provider wrapping the app
- `useTranslation()` hook returning `t(key)` function
- English translation file (en.json) — ~150-200 keys
- Twi translation file (tw.json) — matching keys
- Language switcher in Settings ProfileSection
- Persist language choice via existing `preferred_language` field on User
- All UI labels, buttons, headers, empty states, error messages translated

**Out of scope:**
- Translating AI chat responses (AI always responds in English)
- RTL layout support
- Ewe/Dagbani translations (framework ready, files added later)
- Dynamic content translation (transaction descriptions, counterparty names)

## Architecture

```
LanguageProvider (wraps App)
├── stores current language in state
├── loads translation JSON lazily
├── provides t(key) function via context
└── syncs with user.preferred_language on login
```

### Translation File Structure

Flat nested JSON keyed by feature area:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "retry": "Retry",
    "offline": "You're offline"
  },
  "nav": {
    "home": "Home",
    "transactions": "Transactions",
    "aiChat": "AI Chat",
    "settings": "Settings"
  },
  "dashboard": {
    "totalBalance": "Total Balance",
    "income": "Income",
    "expenses": "Expenses"
  }
}
```

### Hook Usage

```tsx
const { t } = useTranslation();
return <p>{t('dashboard.totalBalance')}</p>;
```

Fallback: if key not found in current language, return English. If not in English either, return the key itself.

---

## File Structure

### New Files
- `apps/web/src/i18n/en.json` — English translations
- `apps/web/src/i18n/tw.json` — Twi translations
- `apps/web/src/contexts/LanguageContext.tsx` — Provider + hook
- `apps/web/src/hooks/useTranslation.ts` — Re-export for convenience

### Modified Files
- `apps/web/src/App.tsx` — Wrap in LanguageProvider
- `apps/web/src/components/settings/ProfileSection.tsx` — Add language switcher
- All pages and components — replace hardcoded strings with `t()` calls
