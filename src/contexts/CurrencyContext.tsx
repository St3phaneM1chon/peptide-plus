'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
}

interface CurrencyContextType {
  currency: Currency;
  currencies: Currency[];
  setCurrency: (currency: Currency) => void;
  convertPrice: (priceInCAD: number) => number;
  formatPrice: (priceInCAD: number) => string;
}

// Fallback statique utilisé uniquement si la DB est inaccessible
const fallbackCurrencies: Currency[] = [
  { code: 'CAD', name: 'Dollar canadien', symbol: '$', exchangeRate: 1 },
  { code: 'USD', name: 'Dollar américain', symbol: '$', exchangeRate: 0.74 },
  { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.68 },
];

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_STORAGE_KEY = 'biocycle-currency';

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(fallbackCurrencies[0]);
  const [currencies, setCurrencies] = useState<Currency[]>(fallbackCurrencies);

  // Charger les devises depuis la DB via API puis la préférence locale
  useEffect(() => {
    fetch('/api/currencies')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.currencies?.length) {
          const dbCurrencies: Currency[] = data.currencies.map((c: { code: string; name: string; symbol: string; exchangeRate: number }) => ({
            code: c.code,
            name: c.name,
            symbol: c.symbol,
            exchangeRate: Number(c.exchangeRate),
          }));
          setCurrencies(dbCurrencies);
          // Appliquer la préférence stockée
          const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
          if (stored) {
            const found = dbCurrencies.find((c) => c.code === stored);
            if (found) setCurrencyState(found);
          }
        } else {
          // Fallback: utiliser les taux statiques + préférence locale
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

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency.code);
  };

  const convertPrice = (priceInCAD: number): number => {
    return priceInCAD * currency.exchangeRate;
  };

  const formatPrice = (priceInCAD: number): string => {
    const converted = convertPrice(priceInCAD);
    
    // Format based on currency
    const formatter = new Intl.NumberFormat(
      currency.code === 'EUR' ? 'fr-FR' : 'en-CA',
      {
        style: 'currency',
        currency: currency.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
    
    return formatter.format(converted);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencies,
        setCurrency,
        convertPrice,
        formatPrice,
      }}
    >
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
