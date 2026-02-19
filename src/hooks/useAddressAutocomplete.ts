'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface AddressComponents {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

interface Prediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

// Declare Google Maps types
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: {
                input: string;
                types?: string[];
                componentRestrictions?: { country: string | string[] };
              },
              callback: (predictions: Prediction[] | null, status: string) => void
            ) => void;
          };
          PlacesService: new (el: HTMLDivElement) => {
            getDetails: (
              request: { placeId: string; fields: string[] },
              callback: (place: GoogleMapsPlaceResult | null, status: string) => void
            ) => void;
          };
          PlacesServiceStatus: {
            OK: string;
            ZERO_RESULTS: string;
          };
        };
      };
    };
  }

  interface GoogleMapsPlaceResult {
    address_components?: {
      long_name: string;
      short_name: string;
      types: string[];
    }[];
    formatted_address?: string;
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-places-script';

export function useAddressAutocomplete() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);

  // Load Google Maps script
  useEffect(() => {
    // If no API key, skip loading
    if (!GOOGLE_MAPS_API_KEY) {
      setIsScriptLoaded(false);
      return;
    }

    // Check if already loaded
    if (window.google?.maps?.places) {
      setIsScriptLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places) {
          setIsScriptLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    // Load script
    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsScriptLoaded(true);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setIsScriptLoaded(false);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Initialize services when script is loaded
  useEffect(() => {
    if (isScriptLoaded && window.google?.maps?.places) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();

      // PlacesService requires a DOM element
      const div = document.createElement('div');
      placesServiceRef.current = new window.google.maps.places.PlacesService(div);
    }
  }, [isScriptLoaded]);

  // Fetch predictions with debounce
  const fetchPredictions = useCallback((input: string) => {
    if (!input.trim() || !isScriptLoaded || !autocompleteServiceRef.current) {
      setPredictions([]);
      return;
    }

    setLoading(true);

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        types: ['address'],
        componentRestrictions: { country: ['ca', 'us'] }, // Focus on Canada and US
      },
      (predictions, status) => {
        setLoading(false);

        if (status === window.google!.maps.places.PlacesServiceStatus.OK && predictions) {
          setPredictions(predictions);
        } else {
          setPredictions([]);
        }
      }
    );
  }, [isScriptLoaded]);

  // Handle input change with debounce
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(value);
    }, 300);
  }, [fetchPredictions]);

  // Parse address components from Google Place Details
  const parseAddressComponents = (addressComponents: GoogleMapsPlaceResult['address_components']): AddressComponents => {
    const components: AddressComponents = {
      street: '',
      city: '',
      province: '',
      postalCode: '',
      country: '',
    };

    if (!addressComponents) return components;

    let streetNumber = '';
    let route = '';

    addressComponents.forEach((component) => {
      const types = component.types;

      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        route = component.long_name;
      } else if (types.includes('locality')) {
        components.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        components.province = component.short_name; // Use short_name for province code
      } else if (types.includes('postal_code')) {
        components.postalCode = component.long_name;
      } else if (types.includes('country')) {
        components.country = component.short_name; // Use short_name for country code
      }
    });

    // Combine street number and route
    components.street = [streetNumber, route].filter(Boolean).join(' ');

    return components;
  };

  // Select a prediction and fetch place details
  const selectPrediction = useCallback(async (
    placeId: string,
    onSelect: (address: AddressComponents) => void
  ) => {
    if (!isScriptLoaded || !placesServiceRef.current) {
      console.error('Google Places service not loaded');
      return;
    }

    placesServiceRef.current.getDetails(
      {
        placeId,
        fields: ['address_components', 'formatted_address'],
      },
      (place, status) => {
        if (status === window.google!.maps.places.PlacesServiceStatus.OK && place) {
          const parsedAddress = parseAddressComponents(place.address_components);
          onSelect(parsedAddress);
          setPredictions([]);
          setInputValue('');
        } else {
          console.error('Failed to get place details:', status);
        }
      }
    );
  }, [isScriptLoaded]);

  // Clear predictions
  const clearPredictions = useCallback(() => {
    setPredictions([]);
  }, []);

  return {
    inputRef,
    predictions,
    loading,
    isEnabled: !!GOOGLE_MAPS_API_KEY && isScriptLoaded,
    inputValue,
    handleInputChange,
    selectPrediction,
    clearPredictions,
  };
}
