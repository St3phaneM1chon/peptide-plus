# Address Autocomplete Feature

## Overview

The Address Autocomplete feature uses Google Places API to provide intelligent address suggestions as users type, automatically filling in street, city, province/state, postal code, and country fields.

## Features

- **Real-time suggestions**: Displays address predictions as you type
- **Smart parsing**: Automatically extracts and fills all address components
- **Keyboard navigation**: Full keyboard support (Arrow keys, Enter, Escape)
- **Accessibility**: ARIA attributes, screen reader support, keyboard-only navigation
- **Graceful degradation**: Works as a normal input if API key is not configured
- **Beautiful UI**: Tailwind-styled dropdown with Google attribution
- **i18n ready**: Uses the existing `useTranslations()` hook

## Implementation

### Files Created

1. **`/src/hooks/useAddressAutocomplete.ts`** - Custom React hook
   - Dynamically loads Google Maps JavaScript API
   - Manages autocomplete service and place details
   - Debounces input (300ms)
   - Parses address components
   - Cleanup on unmount

2. **`/src/components/ui/AddressAutocomplete.tsx`** - Reusable component
   - Shows autocomplete dropdown with predictions
   - Keyboard navigation (arrow keys, enter, escape)
   - Loading indicator
   - Google attribution (required by TOS)
   - Click-outside-to-close behavior

### Files Modified

1. **`/src/app/(shop)/checkout/page.tsx`** - Checkout page
   - Replaced address input with `AddressAutocomplete`
   - Auto-fills city, province, postal code, country on selection

2. **`/src/app/(shop)/account/addresses/page.tsx`** - Account addresses page
   - Replaced address input with `AddressAutocomplete`
   - Same auto-fill behavior

3. **`/src/components/checkout/ShippingAddressForm.tsx`** - Shipping form component
   - Replaced address input with `AddressAutocomplete`

4. **`.env`** and **`.env.local`**
   - Added `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` with setup instructions

## Setup

### 1. Get Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your existing Google OAuth project (or create a new one)
3. Enable the **Places API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Places API"
   - Click "Enable"
4. Create an API key:
   - Go to "Credentials"
   - Click "Create Credentials" > "API Key"
   - **Important**: Restrict the key:
     - Click "Edit API key"
     - Under "API restrictions", select "Restrict key"
     - Choose "Places API" from the dropdown
     - Under "Website restrictions", add:
       - `localhost:3000` (for development)
       - `biocyclepeptides.com` (for production)
5. Copy the API key

### 2. Configure Environment Variable

Add to `.env.local` (for local development):

```bash
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY="YOUR_API_KEY_HERE"
```

**Important**: The variable MUST start with `NEXT_PUBLIC_` to be accessible in the browser.

### 3. Restart Development Server

```bash
npm run dev
```

## Usage

### Basic Usage

```tsx
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';

function MyForm() {
  const [address, setAddress] = useState('');

  return (
    <AddressAutocomplete
      value={address}
      onChange={(addressComponents) => {
        // addressComponents contains: street, city, province, postalCode, country
        console.log(addressComponents);
      }}
      onInputChange={(value) => setAddress(value)}
      placeholder="Start typing your address..."
      className="w-full px-4 py-3 border rounded-lg"
      required
    />
  );
}
```

### Address Components Structure

```typescript
interface AddressComponents {
  street: string;        // e.g., "123 Main St"
  city: string;          // e.g., "Montreal"
  province: string;      // e.g., "QC" (short code)
  postalCode: string;    // e.g., "H2X 1Y6"
  country: string;       // e.g., "CA" (ISO country code)
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | Yes | Current input value |
| `onChange` | `(address: AddressComponents) => void` | Yes | Called when user selects an address |
| `onInputChange` | `(value: string) => void` | No | Called on every keystroke |
| `placeholder` | `string` | No | Input placeholder text |
| `className` | `string` | No | CSS classes for the input |
| `disabled` | `boolean` | No | Disable the input |
| `required` | `boolean` | No | Mark input as required |
| `id` | `string` | No | HTML id attribute |
| `aria-invalid` | `boolean` | No | ARIA invalid state |
| `aria-describedby` | `string` | No | ARIA described-by reference |

## Keyboard Navigation

- **Arrow Down**: Move to next suggestion
- **Arrow Up**: Move to previous suggestion
- **Enter**: Select highlighted suggestion
- **Escape**: Close dropdown and clear suggestions

## Accessibility

The component follows WCAG 2.1 guidelines:

- ✅ ARIA roles (`listbox`, `option`)
- ✅ ARIA attributes (`aria-expanded`, `aria-activedescendant`, `aria-invalid`)
- ✅ Keyboard navigation support
- ✅ Focus management
- ✅ Screen reader announcements
- ✅ Color contrast compliance

## Graceful Degradation

If `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is not set:

- The component works as a normal text input
- No autocomplete suggestions
- User can still enter address manually
- In development, shows a small warning message
- In production, silently falls back to manual entry

## API Usage & Costs

### Google Places API Pricing

As of 2024:
- **Autocomplete - Per Session**: $0.017 per session (first request + place details)
- **Autocomplete - Per Request**: $0.00283 per request (if not using session)

A "session" starts with the first keystroke and ends when the user selects an address.

### Optimization

This implementation uses **session-based pricing** which is more cost-effective:
- Groups all predictions under one session
- Only charged once per complete address selection
- Much cheaper than per-request pricing

### Monthly Free Tier

Google provides $200 free credit per month:
- ~11,700 autocomplete sessions per month for free
- For a small e-commerce site, this should cover most usage

## Security Best Practices

1. **API Key Restrictions** (required):
   - Restrict to Places API only
   - Add HTTP referrer restrictions (your domains)
   - Monitor usage in Google Cloud Console

2. **Rate Limiting**:
   - The hook debounces input (300ms)
   - Reduces API calls significantly
   - Only makes requests for valid input

3. **Environment Variables**:
   - Never commit API keys to git
   - Use `.env.local` for local dev
   - Use proper secrets management in production

## Testing

### With API Key

1. Navigate to checkout or account addresses page
2. Start typing an address
3. Verify dropdown appears with suggestions
4. Select a suggestion
5. Verify all fields are auto-filled

### Without API Key

1. Remove `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` from `.env.local`
2. Restart dev server
3. Navigate to checkout
4. Verify input works as normal text field
5. No errors in console

## Troubleshooting

### Dropdown not appearing

1. Check API key is set and starts with `NEXT_PUBLIC_`
2. Check browser console for errors
3. Verify Places API is enabled in Google Cloud
4. Check API key restrictions (domains, API access)

### "RefererNotAllowedMapError"

- Add your domain to HTTP referrer restrictions in API key settings
- For local dev, add `localhost:3000`

### No results for certain addresses

- Google Places API focuses on Canada and US (see `componentRestrictions` in hook)
- Some rural or new addresses may not be indexed yet
- Users can still enter manually

## Future Enhancements

Potential improvements:

1. **Country-specific behavior**: Adjust suggestions based on selected country
2. **Recent addresses**: Show user's recent/favorite addresses first
3. **Address validation**: Validate postal code format against country
4. **Multi-language**: Pass current locale to Google API for localized results
5. **Caching**: Cache common predictions to reduce API calls
6. **Analytics**: Track autocomplete usage and conversion rates

## Support

For issues or questions:
- Check Google Places API documentation: https://developers.google.com/maps/documentation/places/web-service
- Review implementation in `/src/hooks/useAddressAutocomplete.ts`
- Test without API key to rule out configuration issues
