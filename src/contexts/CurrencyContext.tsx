'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface Currency {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isDefault?: boolean;
}

interface CurrencyContextType {
  currency: Currency;
  currencies: Currency[];
  setCurrency: (currency: Currency) => void;
  convertPrice: (priceInCAD: number) => number;
  formatPrice: (priceInCAD: number) => string;
  /** Returns the currency code lowercased for Stripe (e.g. 'cad', 'usd') */
  stripeCurrencyCode: string;
}

// Fallback statique utilisé uniquement si la DB est inaccessible
const fallbackCurrencies: Currency[] = [
  { code: 'CAD', name: 'Dollar canadien', symbol: '$', exchangeRate: 1, isDefault: true },
  { code: 'USD', name: 'Dollar américain', symbol: '$', exchangeRate: 0.74, isDefault: false },
  { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.68, isDefault: false },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3', exchangeRate: 0.58, isDefault: false },
];

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_STORAGE_KEY = 'biocycle-currency';
const CURRENCIES_CACHE_KEY = 'biocycle-currencies-cache';
const CURRENCIES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CurrenciesCache {
  currencies: Currency[];
  timestamp: number;
}

/** Read cached currencies from localStorage. Returns null if expired or absent. */
function getCachedCurrencies(): Currency[] | null {
  try {
    const raw = localStorage.getItem(CURRENCIES_CACHE_KEY);
    if (!raw) return null;
    const cache: CurrenciesCache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CURRENCIES_CACHE_TTL_MS) return null;
    if (!Array.isArray(cache.currencies) || cache.currencies.length === 0) return null;
    return cache.currencies;
  } catch {
    return null;
  }
}

/** Write currencies to localStorage cache. */
function setCachedCurrencies(currencies: Currency[]) {
  try {
    const cache: CurrenciesCache = { currencies, timestamp: Date.now() };
    localStorage.setItem(CURRENCIES_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable - ignore
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(fallbackCurrencies[0]);
  const [currencies, setCurrencies] = useState<Currency[]>(fallbackCurrencies);

  // Apply user currency preference given a list of available currencies
  const applyUserPreference = useCallback((availableCurrencies: Currency[]) => {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored) {
      const found = availableCurrencies.find((c) => c.code === stored);
      if (found) { setCurrencyState(found); return; }
    }
    // Use the DB-configured default (from SiteSettings via isDefault flag)
    const dbDefault = availableCurrencies.find((c) => c.isDefault);
    if (dbDefault) setCurrencyState(dbDefault);
  }, []);

  // Load currencies from cache first, then fetch if cache expired
  useEffect(() => {
    // 1. Try cache first (avoids network request on most page loads)
    const cached = getCachedCurrencies();
    if (cached) {
      setCurrencies(cached);
      applyUserPreference(cached);
      return; // Cache hit -- no fetch needed
    }

    // 2. Cache miss or expired -- fetch from API
    fetch('/api/currencies')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.currencies?.length) {
          const dbCurrencies: Currency[] = data.currencies.map((c: { id?: string; code: string; name: string; symbol: string; exchangeRate: number; isDefault?: boolean }) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            symbol: c.symbol,
            exchangeRate: Number(c.exchangeRate),
            isDefault: c.isDefault,
          }));
          setCurrencies(dbCurrencies);
          setCachedCurrencies(dbCurrencies);
          applyUserPreference(dbCurrencies);
        } else {
          const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
          if (stored) {
            const found = fallbackCurrencies.find((c) => c.code === stored);
            if (found) setCurrencyState(found);
          }
        }
      })
      .catch(() => {
        const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
        if (stored) {
          const found = fallbackCurrencies.find((c) => c.code === stored);
          if (found) setCurrencyState(found);
        }
      });
  }, [applyUserPreference]);

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency.code);
  }, []);

  const convertPrice = useCallback((priceInCAD: number): number => {
    return priceInCAD * currency.exchangeRate;
  }, [currency.exchangeRate]);

  // Track whether we have hydrated to avoid SSR/client mismatch (React #418)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  // Memoize Intl.NumberFormat instance to avoid re-creating on every formatPrice call
  // Use a stable locale ('en-CA') for SSR and initial client render to prevent hydration mismatch,
  // then switch to navigator.language after hydration.
  const formatter = useMemo(() => {
    const userLocale = hydrated
      && typeof navigator !== 'undefined'
      && navigator.language
        ? navigator.language
        : 'en-CA';

    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currency.code, hydrated]);

  const formatPrice = useCallback((priceInCAD: number): string => {
    const converted = priceInCAD * currency.exchangeRate;
    return formatter.format(converted);
  }, [currency.exchangeRate, formatter]);

  const stripeCurrencyCode = currency.code.toLowerCase();

  const value = useMemo(() => ({
    currency,
    currencies,
    setCurrency,
    convertPrice,
    formatPrice,
    stripeCurrencyCode,
  }), [currency, currencies, setCurrency, convertPrice, formatPrice, stripeCurrencyCode]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
