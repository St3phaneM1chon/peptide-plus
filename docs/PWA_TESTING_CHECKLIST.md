# PWA Testing Checklist

## Pre-Deployment Checklist

### 1. Generate Icons ⚠️ REQUIRED

**Current Status**: Placeholder SVG only

Choose one method:

- [ ] **Option A**: Open `scripts/create-basic-icons.html` in browser
  - Click "Generate Icons"
  - Download all 10 icon files
  - Save to `public/icons/` directory

- [ ] **Option B**: Use Node.js script
  ```bash
  npm install sharp
  node scripts/generate-pwa-icons.js
  ```

- [ ] **Option C**: Use online tool
  - Visit https://www.pwabuilder.com/imageGenerator
  - Upload 512x512 source image
  - Download and extract to `public/icons/`

**Required Files**:
```
✓ icon-72.png
✓ icon-96.png
✓ icon-128.png
✓ icon-144.png
✓ icon-152.png
✓ icon-192.png     ← Critical
✓ icon-384.png
✓ icon-512.png     ← Critical
✓ icon-maskable-192.png
✓ icon-maskable-512.png
```

### 2. Verify Files

- [x] `public/manifest.json` exists
- [x] `public/sw.js` exists
- [x] `public/offline.html` exists
- [ ] All 10 icon files exist in `public/icons/`
- [x] `src/components/ui/InstallPWA.tsx` exists
- [x] Root layout updated with PWA meta tags
- [x] Shop layout includes InstallPWA component

### 3. Code Review

- [x] Service worker version is set (`CACHE_VERSION = 'v1'`)
- [x] Manifest colors match brand (#f97316)
- [x] Offline page is branded
- [x] Install prompt has proper dismissal logic

## Local Testing (Development)

### Chrome DevTools

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Open Chrome DevTools** (F12)

3. **Application Tab > Manifest**:
   - [ ] No errors shown
   - [ ] Name: "BioCycle Peptides"
   - [ ] Short name: "BioCycle"
   - [ ] Start URL: "/"
   - [ ] Theme color: #f97316
   - [ ] All icons listed (after you generate them)

4. **Application Tab > Service Workers**:
   - [ ] Service worker registered and activated
   - [ ] Status: "activated and is running"
   - [ ] Source: `/sw.js`

5. **Application Tab > Storage**:
   - [ ] Cache Storage shows `biocycle-static-v1`
   - [ ] Cached files include `/`, `/offline.html`, `/manifest.json`

6. **Network Tab**:
   - [ ] Reload page
   - [ ] Some requests show "(from ServiceWorker)"

### Offline Testing

1. **Application Tab > Service Workers**:
   - [ ] Check "Offline" checkbox

2. **Navigate to different pages**:
   - [ ] Home page loads from cache
   - [ ] Offline page shows for uncached pages
   - [ ] Images load from cache

3. **Disable offline mode**:
   - [ ] Page automatically reloads
   - [ ] Fresh content fetched

### Install Prompt Testing

1. **Clear dismissal flags**:
   - Application Tab > Storage > Local Storage
   - Delete `pwa-install-dismissed-until` key

2. **Reload page**:
   - [ ] Install banner appears after 3 seconds
   - [ ] Banner shows BioCycle branding
   - [ ] "Install Now" button works
   - [ ] "Not now" dismisses for 7 days
   - [ ] Installing hides banner permanently

## Production Testing

### Pre-Deployment

- [ ] All icons generated and committed
- [ ] Code deployed to staging/production
- [ ] HTTPS is enabled (required for PWA)
- [ ] All files accessible at correct URLs:
  - https://yourdomain.com/manifest.json
  - https://yourdomain.com/sw.js
  - https://yourdomain.com/offline.html
  - https://yourdomain.com/icons/icon-192.png
  - https://yourdomain.com/icons/icon-512.png

### Lighthouse Audit

1. **Run Lighthouse**:
   ```bash
   npm install -g lighthouse
   lighthouse https://biocyclepeptides.com --view
   ```

2. **PWA Score**:
   - [ ] Score: 100/100 (target)
   - [ ] "Installable" badge shown
   - [ ] All PWA checks pass:
     - [ ] Registers a service worker
     - [ ] Responds with 200 when offline
     - [ ] Has a valid manifest
     - [ ] Uses HTTPS
     - [ ] Redirects HTTP to HTTPS
     - [ ] Has a viewport meta tag
     - [ ] Has a theme-color meta tag
     - [ ] Provides icons

### Mobile Testing - Android (Chrome)

1. **Visit site on Android phone**:
   - [ ] Chrome shows install banner automatically
   - OR custom InstallPWA banner appears

2. **Install the app**:
   - [ ] Tap "Install" or "Add to Home Screen"
   - [ ] Icon appears on home screen
   - [ ] Icon is clear and recognizable

3. **Launch app**:
   - [ ] Opens in standalone mode (no browser chrome)
   - [ ] Splash screen shows (uses icon + background color)
   - [ ] Status bar color matches theme (#f97316)

4. **Test functionality**:
   - [ ] Navigation works
   - [ ] Can browse products
   - [ ] Can add to cart
   - [ ] Can checkout
   - [ ] All images load

5. **Test offline**:
   - [ ] Enable airplane mode
   - [ ] App still launches
   - [ ] Previously viewed pages load
   - [ ] Offline page shows for new pages
   - [ ] Disable airplane mode
   - [ ] App reconnects automatically

### Mobile Testing - iOS (Safari)

1. **Visit site on iPhone**:
   - [ ] Site loads correctly

2. **Add to Home Screen**:
   - [ ] Tap Share button
   - [ ] Tap "Add to Home Screen"
   - [ ] Edit name if desired
   - [ ] Icon appears on home screen

3. **Launch app**:
   - [ ] Opens in standalone mode (no Safari UI)
   - [ ] Uses icon from manifest
   - [ ] Status bar is default style

4. **Test functionality**:
   - [ ] Navigation works
   - [ ] All features functional
   - [ ] Offline support works

**Note**: iOS doesn't show automatic install prompts. Users must manually add to home screen.

### Desktop Testing

1. **Chrome Desktop**:
   - [ ] Install icon appears in address bar (after icons added)
   - [ ] Click install icon
   - [ ] App installs as desktop app
   - [ ] App window opens (no browser tabs/chrome)
   - [ ] App appears in applications/programs list

2. **Edge Desktop**:
   - [ ] Same as Chrome
   - [ ] "App available" banner shows

## Post-Installation Testing

### Navigation

- [ ] Internal links work
- [ ] External links open in browser
- [ ] Back button works
- [ ] Deep links work
- [ ] App shortcuts work (Shop, Orders, Cart, Lab Reports)

### Features

- [ ] Shopping cart persists
- [ ] User login works
- [ ] Forms submit correctly
- [ ] Images load
- [ ] Videos play (if any)
- [ ] Chat widget works
- [ ] Newsletter signup works

### Performance

- [ ] Initial load < 3 seconds
- [ ] Subsequent loads < 1 second (from cache)
- [ ] Smooth scrolling
- [ ] No lag or jank
- [ ] Cache size reasonable (< 50MB)

### Updates

1. **Make a code change**:
   - Update service worker version: `CACHE_VERSION = 'v2'`
   - Deploy to production

2. **Test update**:
   - [ ] Close and reopen app
   - [ ] New service worker activates
   - [ ] Old caches cleaned up
   - [ ] New content loads
   - [ ] No errors

## Analytics & Monitoring

### Track Install Events

Add to your analytics:

```javascript
// Track PWA installs
window.addEventListener('appinstalled', () => {
  gtag('event', 'pwa_installed', {
    event_category: 'PWA',
    event_label: 'App Installed'
  });
});
```

### Monitor Metrics

- [ ] Installation rate (% of users who install)
- [ ] Standalone mode usage (% using as app vs browser)
- [ ] Offline page views
- [ ] Service worker errors
- [ ] Cache hit rate

### Error Tracking

Check browser console for:
- Service worker registration errors
- Cache errors
- Manifest parsing errors
- Icon loading errors

## Known Issues & Workarounds

### iOS Safari Limitations

- **No automatic install prompt**: Users must manually add to home screen
- **Limited cache**: iOS may clear cache when storage is low
- **No background sync**: Push notifications require native app
- **Workaround**: Add clear instructions for iOS users

### Cache Update Delays

- **Issue**: Service worker updates on next visit, not immediately
- **Workaround**: Implement "Update available" notification with reload button

### Icon Safe Zones

- **Issue**: Android may crop icons on some devices
- **Workaround**: Use maskable icons with 10% padding

## Troubleshooting

### Install Prompt Not Showing

1. Check PWA criteria are met (Lighthouse audit)
2. Verify HTTPS in production
3. Clear browser cache completely
4. Check console for errors
5. Verify all icon files exist

### Service Worker Not Registering

1. Check `sw.js` is accessible
2. Verify HTTPS (required)
3. Check console for syntax errors
4. Try incognito/private browsing

### Icons Not Showing

1. Generate icons from placeholder SVG
2. Check file paths in manifest.json
3. Verify files exist at correct location
4. Clear cache and reinstall

### Offline Page Not Showing

1. Verify service worker is active
2. Check offline.html is in cache
3. Use DevTools to go offline and test
4. Check fetch event handler logic

## Success Criteria

Before marking PWA complete:

- [ ] All 10 icon files generated and deployed
- [ ] Lighthouse PWA score: 100/100
- [ ] Install works on Android Chrome
- [ ] Add to home screen works on iOS Safari
- [ ] Offline page loads when offline
- [ ] App shortcuts work
- [ ] Standalone mode works (no browser UI)
- [ ] Performance is good (< 3s initial load)
- [ ] No console errors
- [ ] Tested on real devices (not just emulators)

## Resources

- **Manifest Validator**: https://manifest-validator.appspot.com/
- **PWA Checklist**: https://web.dev/pwa-checklist/
- **Icon Generator**: https://www.pwabuilder.com/imageGenerator
- **Testing Guide**: https://web.dev/learn/pwa/tools-and-debug/

## Next Steps After PWA Setup

1. **Monitor adoption**:
   - Track install events
   - Measure engagement (PWA vs browser)

2. **Optimize further**:
   - Add app screenshots to manifest
   - Implement push notifications
   - Add background sync for order updates

3. **Marketing**:
   - Add "Install our app" banner to emails
   - Promote PWA on social media
   - Add to app store directories (like PWA Directory)

4. **Iterate**:
   - Gather user feedback
   - Improve offline experience
   - Expand cached content
