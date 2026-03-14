import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import en from '@/i18n/en.json';

type Translations = Record<string, unknown>;
type Language = 'en' | 'tw' | 'ee' | 'dag';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageState | null>(null);

// Lazy-load non-English translations
const translationCache: Partial<Record<Language, Translations>> = { en };

async function loadTranslations(lang: Language): Promise<Translations> {
  if (translationCache[lang]) return translationCache[lang]!;
  try {
    const mod = await import(`@/i18n/${lang}.json`);
    translationCache[lang] = mod.default;
    return mod.default;
  } catch {
    return en; // fallback to English
  }
}

function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<Translations>(en);

  // Load translations when language changes
  useEffect(() => {
    loadTranslations(language).then(setTranslations);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cedisense-lang', lang);
  }, []);

  // Initialize from localStorage or user preference
  useEffect(() => {
    const saved = localStorage.getItem('cedisense-lang') as Language | null;
    if (saved && ['en', 'tw', 'ee', 'dag'].includes(saved)) {
      setLanguageState(saved);
    }
  }, []);

  const t = useCallback((key: string): string => {
    // Try current language first
    const value = getNestedValue(translations, key);
    if (value) return value;
    // Fallback to English
    const fallback = getNestedValue(en, key);
    if (fallback) return fallback;
    // Last resort: return the key
    return key;
  }, [translations]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
  return ctx;
}
