'use client';

import { useEffect, useRef, useState } from 'react';
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete';
import { useI18n } from '@/i18n/client';

interface AddressComponents {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: AddressComponents) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onInputChange,
  placeholder,
  className = '',
  disabled = false,
  required = false,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: AddressAutocompleteProps) {
  const { t } = useI18n();
  const {
    inputRef,
    predictions,
    loading,
    isEnabled,
    inputValue,
    handleInputChange,
    selectPrediction,
    clearPredictions,
  } = useAddressAutocomplete();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal input value with external value
  useEffect(() => {
    if (value && !inputValue) {
      handleInputChange(value);
    }
  }, [value, inputValue, handleInputChange]);

  // Show dropdown when predictions are available
  useEffect(() => {
    setIsOpen(predictions.length > 0);
    setSelectedIndex(-1);
  }, [predictions]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    handleInputChange(newValue);
    onInputChange?.(newValue);
  };

  // Handle prediction selection
  const handleSelect = (placeId: string) => {
    selectPrediction(placeId, (address) => {
      onChange(address);
      setIsOpen(false);
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelect(predictions[selectedIndex].place_id);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        clearPredictions();
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex + 1] as HTMLElement; // +1 for attribution
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue || value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('checkout.address')}
          className={className}
          disabled={disabled}
          required={required}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={isOpen ? 'address-autocomplete-dropdown' : undefined}
          aria-expanded={isOpen}
          aria-activedescendant={
            selectedIndex >= 0 ? `prediction-${selectedIndex}` : undefined
          }
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Predictions dropdown */}
      {isOpen && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          id="address-autocomplete-dropdown"
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {/* Google attribution (required by Google Places API TOS) */}
          <div className="px-3 py-1 text-[10px] text-gray-400 border-b border-gray-100 flex items-center justify-end gap-1">
            <span>powered by</span>
            <svg
              width="50"
              height="16"
              viewBox="0 0 100 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label={t('common.aria.googleLogo')}
            >
              <path
                d="M17.5 16.5c0 4.14-3.36 7.5-7.5 7.5s-7.5-3.36-7.5-7.5 3.36-7.5 7.5-7.5c2.04 0 3.87.78 5.25 2.04l-2.13 2.04c-.63-.6-1.47-.96-2.37-.96-1.95 0-3.54 1.59-3.54 3.54s1.59 3.54 3.54 3.54c1.77 0 3.24-1.17 3.51-2.79H10v-2.88h7.41c.09.48.15.99.15 1.53 0 0-.06.09-.06.09z"
                fill="#4285F4"
              />
              <path d="M28 9h3v15h-3V9zm10.5 0c-2.76 0-5 2.24-5 5v.09c0 2.76 2.24 5 5 5s5-2.24 5-5v-.09c0-2.76-2.24-5-5-5zm0 7.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#EA4335" />
              <path d="M50 9h3v15h-3V9zm10.5 0c-2.76 0-5 2.24-5 5v.09c0 2.76 2.24 5 5 5s5-2.24 5-5v-.09c0-2.76-2.24-5-5-5zm0 7.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FBBC05" />
              <path d="M70 9c-2.76 0-5 2.24-5 5v5c0 2.76 2.24 5 5 5h3v-3h-3c-1.38 0-2.5-1.12-2.5-2.5v-5c0-1.38 1.12-2.5 2.5-2.5h5v10h3V9h-8z" fill="#34A853" />
              <path d="M82 14v5c0 2.76 2.24 5 5 5h3v-3h-3c-1.38 0-2.5-1.12-2.5-2.5V9h-3v5z" fill="#4285F4" />
            </svg>
          </div>

          {/* Predictions list */}
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              id={`prediction-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSelect(prediction.place_id)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-start px-4 py-3 hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                index === selectedIndex ? 'bg-orange-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Location pin icon */}
                <svg
                  className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>

                {/* Address text */}
                <div className="flex-1 min-w-0">
                  {prediction.structured_formatting ? (
                    <>
                      <div className="font-medium text-gray-900 truncate">
                        {prediction.structured_formatting.main_text}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-900">{prediction.description}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No API key fallback message - only show in development */}
      {!isEnabled && process.env.NODE_ENV === 'development' && (
        <p className="mt-1 text-xs text-amber-600">
          Address autocomplete disabled - configure NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
        </p>
      )}
    </div>
  );
}
