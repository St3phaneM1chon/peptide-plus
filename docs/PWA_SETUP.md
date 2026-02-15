# Progressive Web App (PWA) Setup

## Overview

BioCycle Peptides now supports Progressive Web App functionality, allowing customers to install the site as a mobile app for a better shopping experience.

## Features Implemented

### ✅ Core PWA Features

1. **Web App Manifest** (`/public/manifest.json`)
   - App name, description, and branding
   - Multiple icon sizes (72px to 512px)
   - Maskable icons for Android adaptive icons
   - App shortcuts (Shop, Orders, Cart, Lab Reports)
   - Standalone display mode

2. **Service Worker** (`/public/sw.js`)
   - Cache-first strategy for static assets (images, fonts, CSS, JS)
   - Network-first strategy for API calls and HTML pages
   - Offline fallback page
   - Automatic cache versioning and cleanup
   - ~200 lines of lightweight, production-ready code

3. **Offline Support** (`/public/offline.html`)
   - Branded offline fallback page
   - Auto-retry when connection restored
   - Clean, user-friendly design

4. **Install Prompt** (`/src/components/ui/InstallPWA.tsx`)
   - Smart install banner (shows after 3 seconds)
   - Remembers dismissal (7 days for "Not now", 30 days for permanent dismiss)
   - Only shows when PWA criteria are met
   - Mobile-optimized UI

## Installation Status

### ✅ Completed
- [x] Manifest file created
- [x] Service worker implemented
- [x] Offline page created
- [x] Install prompt component
- [x] Root layout updated with PWA meta tags
- [x] Shop layout updated with install prompt
- [x] CSS animations added
- [x] Icon generation tools created

### ⚠️ Pending
- [ ] **Generate actual PWA icons** (currently using placeholders)
- [ ] Test on real mobile devices (iOS Safari, Chrome Android)
- [ ] Add screenshot to manifest for app store listing
- [ ] Optional: Implement push notifications
- [ ] Optional: Add background sync for orders

## Generating Icons

### Quick Start (HTML Tool)

The easiest way to generate icons:

```bash
# Open the icon generator in a browser
open scripts/create-basic-icons.html
```

1. The page will auto-generate all required icon sizes
2. Click each "Download" link to save the icons
3. Save them to `public/icons/` with the correct filenames

### Alternative: Node.js Script

If you have Sharp installed:

```bash
npm install sharp
node scripts/generate-pwa-icons.js
```

### Alternative: Online Tool

1. Visit https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 source image
3. Download all generated sizes
4. Replace files in `public/icons/`

### Required Icon Files

```
public/icons/
├── icon-72.png         (72x72)
├── icon-96.png         (96x96)
├── icon-128.png        (128x128)
├── icon-144.png        (144x144)
├── icon-152.png        (152x152)
├── icon-192.png        (192x192) ← Required
├── icon-384.png        (384x384)
├── icon-512.png        (512x512) ← Required
├── icon-maskable-192.png (192x192 with safe zone)
└── icon-maskable-512.png (512x512 with safe zone)
```

## Testing the PWA

### Local Testing

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test in Chrome:**
   - Open Chrome DevTools (F12)
   - Go to Application tab > Manifest
   - Check for errors
   - Go to Service Workers
   - Verify service worker is registered

3. **Test Install Prompt:**
   - Must be served over HTTPS or localhost
   - Visit the site
   - Wait 3 seconds for install banner
   - Click "Install Now"

### Production Testing

1. **Deploy to production** (must be HTTPS)

2. **Test on Android (Chrome):**
   - Visit the site
   - Chrome will show "Add to Home Screen" banner
   - Install the app
   - Launch from home screen
   - Should open in standalone mode (no browser UI)

3. **Test on iOS (Safari):**
   - Visit the site
   - Tap Share button
   - Tap "Add to Home Screen"
   - The app uses the icons and metadata from manifest

### Lighthouse PWA Audit

```bash
# Run Lighthouse PWA audit
npm install -g lighthouse
lighthouse https://your-domain.com --view
```

Check the PWA category - should score 100/100 when icons are added.

## PWA Criteria Checklist

### Required for Install Prompt

- [x] Served over HTTPS (production only)
- [x] Manifest file with:
  - [x] `name` and `short_name`
  - [x] `start_url`
  - [x] `display: standalone` or `fullscreen`
  - [ ] `icons` array with 192px and 512px icons
- [x] Service worker registered
- [x] Service worker has fetch event handler

### Recommended

- [x] Offline functionality
- [ ] Icons at all recommended sizes
- [ ] Screenshots for app listing
- [x] Theme color matching brand
- [x] Background color
- [x] App shortcuts

## How It Works

### Service Worker Registration

The service worker is registered in the root layout (`/src/app/layout.tsx`):

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

### Caching Strategy

1. **Static Assets** (images, fonts, CSS, JS):
   - Cache-first
   - Stored in `biocycle-static-v1` cache
   - Long-term caching with version cleanup

2. **API Requests** (`/api/*`):
   - Network-first
   - Cached in `biocycle-dynamic-v1`
   - Offline fallback to cache

3. **HTML Pages**:
   - Network-first
   - Cached for offline
   - Falls back to `/offline.html` if unavailable

### Install Prompt Logic

1. Browser fires `beforeinstallprompt` event when PWA criteria met
2. Our component captures and stores the event
3. Shows custom install banner after 3 seconds
4. User can install or dismiss
5. Dismissal stored in localStorage with expiry

## Updating the Service Worker

When you update the service worker:

1. Change the `CACHE_VERSION` constant in `sw.js`
2. Old caches are automatically cleaned up on activation
3. Users get the new service worker on next visit

```javascript
const CACHE_VERSION = 'v2'; // Increment this
```

## Troubleshooting

### Install Prompt Not Showing

- Check HTTPS (required in production)
- Verify all PWA criteria are met
- Check console for errors
- Clear cache and reload
- Check localStorage for dismissal flags

### Service Worker Not Updating

- Increment `CACHE_VERSION` in `sw.js`
- Clear browser cache
- Use DevTools > Application > Service Workers > "Update on reload"

### Icons Not Displaying

- Verify icon files exist in `public/icons/`
- Check manifest.json paths
- Clear cache
- Check browser console for 404 errors

### Offline Page Not Showing

- Check service worker is active
- Verify offline.html is cached
- Go offline in DevTools and navigate

## Performance Impact

The PWA implementation is lightweight and has minimal impact:

- Service worker: ~200 lines, ~6KB gzipped
- Manifest: ~1KB
- Install component: Lazy-loaded, only renders when needed
- Offline page: Only loaded when offline

## Browser Support

- **Chrome/Edge**: Full support ✅
- **Safari iOS**: Partial support (no install prompt, manual add to home screen) ⚠️
- **Firefox**: Partial support ✅
- **Samsung Internet**: Full support ✅

## Next Steps

1. **Generate production icons** using the provided tools
2. **Test on real devices** (iOS and Android)
3. **Add screenshots** to manifest for better app store listing
4. **Monitor analytics** for install rates
5. **Consider push notifications** for order updates (future enhancement)

## Resources

- [PWA Builder](https://www.pwabuilder.com/)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Manifest Generator](https://www.simicart.com/manifest-generator.html/)

## Files Modified/Created

### Created
- `/public/manifest.json` - Web app manifest
- `/public/sw.js` - Service worker
- `/public/offline.html` - Offline fallback page
- `/src/components/ui/InstallPWA.tsx` - Install prompt component
- `/public/icons/icon.svg` - Icon source file
- `/scripts/generate-pwa-icons.js` - Node.js icon generator
- `/scripts/create-basic-icons.html` - Browser-based icon generator
- `/public/icons/README.md` - Icon documentation

### Modified
- `/src/app/layout.tsx` - Added PWA meta tags and service worker registration
- `/src/app/(shop)/layout.tsx` - Added InstallPWA component
- `/src/app/globals.css` - Added slide-up animation

## Support

For issues or questions:
1. Check browser console for errors
2. Use Lighthouse PWA audit
3. Test in Chrome DevTools Application panel
4. Verify all files are properly deployed
