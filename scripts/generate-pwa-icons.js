#!/usr/bin/env node

/**
 * Generate PWA Icons from SVG source
 *
 * This script requires 'sharp' package:
 * npm install sharp
 *
 * Usage:
 * node scripts/generate-pwa-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSVG = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  // Check if sharp is available
  try {
    require.resolve('sharp');
  } catch (e) {
    console.error('❌ Error: sharp package not found');
    console.error('Please install it with: npm install sharp');
    process.exit(1);
  }

  // Check if source SVG exists
  if (!fs.existsSync(inputSVG)) {
    console.error('❌ Error: icon.svg not found at', inputSVG);
    process.exit(1);
  }

  // Generate standard icons
  for (const size of sizes) {
    try {
      await sharp(inputSVG)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, `icon-${size}.png`));

      console.log(`✓ Generated icon-${size}.png`);
    } catch (error) {
      console.error(`❌ Failed to generate icon-${size}.png:`, error.message);
    }
  }

  // Generate maskable icons (with safe zone padding)
  for (const size of [192, 512]) {
    try {
      // For maskable icons, we add 10% padding (safe zone)
      const innerSize = Math.floor(size * 0.8);
      const padding = Math.floor((size - innerSize) / 2);

      await sharp(inputSVG)
        .resize(innerSize, innerSize)
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 249, g: 115, b: 22, alpha: 1 } // Orange background
        })
        .png()
        .toFile(path.join(outputDir, `icon-maskable-${size}.png`));

      console.log(`✓ Generated icon-maskable-${size}.png`);
    } catch (error) {
      console.error(`❌ Failed to generate icon-maskable-${size}.png:`, error.message);
    }
  }

  console.log('\n✅ Icon generation complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Review the generated icons in public/icons/');
  console.log('2. Replace with professional brand icons if available');
  console.log('3. Test the PWA installation on mobile devices');
}

generateIcons().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
