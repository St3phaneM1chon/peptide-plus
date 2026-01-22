/**
 * LANGUAGE SELECTOR
 * Sélecteur de langue avec dropdown
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n, locales, localeNames, localeFlags, type Locale } from '@/i18n/client';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'list' | 'minimal';
  showFlag?: boolean;
  showName?: boolean;
  className?: string;
}

export function LanguageSelector({
  variant = 'dropdown',
  showFlag = true,
  showName = true,
  className = '',
}: LanguageSelectorProps) {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fermer avec Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  if (variant === 'list') {
    return (
      <div className={`language-list ${className}`}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleSelect(loc)}
            className={`language-list-item ${loc === locale ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              width: '100%',
              border: 'none',
              background: loc === locale ? 'var(--gray-100)' : 'transparent',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background 0.2s ease',
            }}
          >
            {showFlag && <span style={{ fontSize: '20px' }}>{localeFlags[loc]}</span>}
            {showName && (
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: loc === locale ? 600 : 400,
                  color: 'var(--gray-500)',
                }}
              >
                {localeNames[loc]}
              </span>
            )}
            {loc === locale && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                width="16"
                height="16"
                style={{ marginLeft: 'auto', color: '#4CAF50' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className={`language-select-minimal ${className}`}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--gray-200)',
          borderRadius: '6px',
          background: 'white',
          cursor: 'pointer',
          fontSize: '14px',
          color: 'var(--gray-500)',
        }}
        aria-label={t('nav.language')}
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {showFlag ? `${localeFlags[loc]} ` : ''}{localeNames[loc]}
          </option>
        ))}
      </select>
    );
  }

  // Dropdown (default)
  return (
    <div
      ref={dropdownRef}
      className={`language-selector ${className}`}
      style={{ position: 'relative' }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="language-trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('nav.language')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          border: '1px solid var(--gray-200)',
          borderRadius: '8px',
          background: 'white',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {showFlag && <span style={{ fontSize: '18px' }}>{localeFlags[locale]}</span>}
        {showName && (
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
            {localeNames[locale]}
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          width="16"
          height="16"
          style={{
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--gray-400)',
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="language-dropdown"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: '180px',
            backgroundColor: 'white',
            border: '1px solid var(--gray-200)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleSelect(loc)}
              role="option"
              aria-selected={loc === locale}
              className="language-option"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                width: '100%',
                border: 'none',
                background: loc === locale ? 'var(--gray-100)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (loc !== locale) {
                  (e.target as HTMLElement).style.background = 'var(--gray-50)';
                }
              }}
              onMouseLeave={(e) => {
                if (loc !== locale) {
                  (e.target as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '20px' }}>{localeFlags[loc]}</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: loc === locale ? 600 : 400,
                  color: 'var(--gray-500)',
                  flex: 1,
                }}
              >
                {localeNames[loc]}
              </span>
              {loc === locale && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="#4CAF50"
                  width="16"
                  height="16"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
