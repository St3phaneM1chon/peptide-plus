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

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(fallbackCurrencies[0]);
  const [currencies, setCurrencies] = useState<Currency[]>(fallbackCurrencies);

  // Load currencies from DB + apply user preference or SiteSettings default
  useEffect(() => {
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

          // Priority: 1) user stored preference, 2) DB default currency, 3) first currency
          const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
          if (stored) {
            const found = dbCurrencies.find((c) => c.code === stored);
            if (found) { setCurrencyState(found); return; }
          }
          // Use the DB-configured default (from SiteSettings via isDefault flag)
          const dbDefault = dbCurrencies.find((c) => c.isDefault);
          if (dbDefault) setCurrencyState(dbDefault);
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
  }, []);

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
