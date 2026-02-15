# PWA Icons

## Required Icons

The PWA requires the following icon sizes:

- **72x72** - Small mobile icon
- **96x96** - Small mobile icon
- **128x128** - Medium mobile icon
- **144x144** - Medium mobile icon
- **152x152** - iOS icon
- **192x192** - Standard PWA icon (required)
- **384x384** - Large icon
- **512x512** - Extra large icon (required)
- **192x192 (maskable)** - Maskable icon for Android adaptive icons
- **512x512 (maskable)** - Maskable icon for Android adaptive icons

## Generating Icons

### Option 1: Online Tool (Recommended)
1. Visit https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 source image
3. Download all generated sizes
4. Replace the placeholder files in this directory

### Option 2: Using ImageMagick
```bash
# Install ImageMagick first
brew install imagemagick

# Generate all sizes from icon.svg
magick icon.svg -resize 72x72 icon-72.png
magick icon.svg -resize 96x96 icon-96.png
magick icon.svg -resize 128x128 icon-128.png
magick icon.svg -resize 144x144 icon-144.png
magick icon.svg -resize 152x152 icon-152.png
magick icon.svg -resize 192x192 icon-192.png
magick icon.svg -resize 384x384 icon-384.png
magick icon.svg -resize 512x512 icon-512.png
```

### Option 3: Using Node.js Script
```bash
npm install sharp
node generate-icons.js
```

## Maskable Icons

Maskable icons need safe zones to ensure the icon looks good on all Android devices.
The safe zone is typically 80% of the total icon size (centered).

For a 512x512 maskable icon:
- Total size: 512x512
- Safe zone: 410x410 (centered)
- Background: Should extend to full 512x512

## Current Status

**⚠️ PLACEHOLDER ICONS IN USE**

The current icons are SVG placeholders. Please replace with proper branded icons before production deployment.

## Design Guidelines

- Use BioCycle brand colors: Orange gradient (#f97316 to #ea580c)
- Include "BC" monogram or full logo
- Ensure good contrast and readability at small sizes
- Test on both light and dark backgrounds
