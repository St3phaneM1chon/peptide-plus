# Quick Start: Address Autocomplete

## Enable in 3 Steps (5 minutes)

### Step 1: Get Google API Key (3 minutes)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your project (or create new)
3. Click "Enable APIs and Services"
4. Search "Places API" → Click "Enable"
5. Go to "Credentials" → "Create Credentials" → "API Key"
6. Click "Edit API key" → Restrict:
   - **API restrictions**: Select "Places API"
   - **Website restrictions**: Add `localhost:3000` and `biocyclepeptides.com`
7. Copy your API key

### Step 2: Add to Environment (30 seconds)

Add to `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY="paste_your_api_key_here"
```

### Step 3: Restart & Test (1 minute)

```bash
npm run dev
```

Go to: http://localhost:3000/checkout
- Start typing an address
- See dropdown suggestions
- Select one → All fields auto-fill!

## Without API Key

No problem! It still works:
- Normal text input
- Manual address entry
- No autocomplete
- Zero errors

## Cost

- **Free tier**: $200/month credit
- **Usage**: ~$0.017 per checkout
- **Expected**: $10-20/month for most sites
- **Monitor**: https://console.cloud.google.com/billing

## Where It Works

✅ Checkout page (shipping address)
✅ Account addresses (add/edit)
✅ Shipping address form

## Features

- 🚀 Real-time suggestions
- ⌨️ Keyboard navigation
- ♿ Fully accessible (WCAG 2.1)
- 🌍 Canada & US focused
- 🎨 Beautiful Tailwind UI
- 📱 Mobile responsive
- 🔒 Secure & restricted
- 💰 Cost-optimized

## Need Help?

📖 Full docs: `/docs/ADDRESS_AUTOCOMPLETE.md`
📝 Implementation: `/IMPLEMENTATION_SUMMARY.md`
🔧 Code: `/src/hooks/useAddressAutocomplete.ts`

---

**That's it!** Add the API key and you're done.
