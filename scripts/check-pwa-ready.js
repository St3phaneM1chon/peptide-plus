#!/usr/bin/env node

/**
 * PWA Readiness Checker
 *
 * Verifies that all PWA files are in place and configured correctly
 * Run: node scripts/check-pwa-ready.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ICONS = path.join(PUBLIC, 'icons');

let errors = 0;
let warnings = 0;

console.log('🔍 BioCycle PWA Readiness Check\n');

// Check required files
console.log('📁 Checking required files...\n');

const requiredFiles = [
  { path: path.join(PUBLIC, 'manifest.json'), name: 'Web App Manifest' },
  { path: path.join(PUBLIC, 'sw.js'), name: 'Service Worker' },
  { path: path.join(PUBLIC, 'offline.html'), name: 'Offline Page' },
];

requiredFiles.forEach(({ path: filePath, name }) => {
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${name}`);
  } else {
    console.log(`  ❌ ${name} - MISSING`);
    errors++;
  }
});

// Check icons
console.log('\n🎨 Checking PWA icons...\n');

const requiredIcons = [
  'icon-72.png',
  'icon-96.png',
  'icon-128.png',
  'icon-144.png',
  'icon-152.png',
  'icon-192.png',
  'icon-384.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
];

const criticalIcons = ['icon-192.png', 'icon-512.png'];

requiredIcons.forEach(iconFile => {
  const iconPath = path.join(ICONS, iconFile);
  const exists = fs.existsSync(iconPath);
  const isCritical = criticalIcons.includes(iconFile);

  if (exists) {
    const stats = fs.statSync(iconPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  ✅ ${iconFile} (${sizeKB} KB)`);
  } else {
    const marker = isCritical ? '❌' : '⚠️';
    console.log(`  ${marker} ${iconFile} - MISSING ${isCritical ? '(CRITICAL)' : ''}`);
    if (isCritical) {
      errors++;
    } else {
      warnings++;
    }
  }
});

// Check manifest content
console.log('\n📋 Checking manifest.json...\n');

try {
  const manifestPath = path.join(PUBLIC, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const checks = [
    { key: 'name', value: manifest.name, expected: 'BioCycle Peptides' },
    { key: 'short_name', value: manifest.short_name, expected: 'BioCycle' },
    { key: 'start_url', value: manifest.start_url, expected: '/' },
    { key: 'display', value: manifest.display, expected: 'standalone' },
    { key: 'theme_color', value: manifest.theme_color, expected: '#f97316' },
    { key: 'background_color', value: manifest.background_color, expected: '#ffffff' },
  ];

  checks.forEach(({ key, value, expected }) => {
    if (value === expected) {
      console.log(`  ✅ ${key}: "${value}"`);
    } else {
      console.log(`  ⚠️ ${key}: "${value}" (expected: "${expected}")`);
      warnings++;
    }
  });

  // Check icons array
  if (manifest.icons && manifest.icons.length >= 2) {
    console.log(`  ✅ icons: ${manifest.icons.length} sizes defined`);
  } else {
    console.log(`  ⚠️ icons: ${manifest.icons?.length || 0} sizes (need at least 2)`);
    warnings++;
  }

  // Check shortcuts
  if (manifest.shortcuts && manifest.shortcuts.length > 0) {
    console.log(`  ✅ shortcuts: ${manifest.shortcuts.length} defined`);
  } else {
    console.log(`  ℹ️ shortcuts: none defined (optional)`);
  }

} catch (error) {
  console.log(`  ❌ Error reading manifest: ${error.message}`);
  errors++;
}

// Check service worker
console.log('\n⚙️ Checking service worker...\n');

try {
  const swPath = path.join(PUBLIC, 'sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');

  // Check for required patterns
  const patterns = [
    { name: 'CACHE_VERSION', pattern: /CACHE_VERSION\s*=\s*['"]v\d+['"]/ },
    { name: 'install event', pattern: /addEventListener\(['"]install['"]/ },
    { name: 'activate event', pattern: /addEventListener\(['"]activate['"]/ },
    { name: 'fetch event', pattern: /addEventListener\(['"]fetch['"]/ },
    { name: 'offline.html', pattern: /offline\.html/ },
  ];

  patterns.forEach(({ name, pattern }) => {
    if (pattern.test(swContent)) {
      console.log(`  ✅ ${name}`);
    } else {
      console.log(`  ⚠️ ${name} - not found`);
      warnings++;
    }
  });

  // Extract cache version
  const versionMatch = swContent.match(/CACHE_VERSION\s*=\s*['"]v(\d+)['"]/);
  if (versionMatch) {
    console.log(`  ℹ️ Cache version: v${versionMatch[1]}`);
  }

} catch (error) {
  console.log(`  ❌ Error reading service worker: ${error.message}`);
  errors++;
}

// Check component
console.log('\n🎨 Checking InstallPWA component...\n');

const componentPath = path.join(ROOT, 'src/components/ui/InstallPWA.tsx');
if (fs.existsSync(componentPath)) {
  console.log('  ✅ Component exists');

  const componentContent = fs.readFileSync(componentPath, 'utf8');
  if (componentContent.includes('beforeinstallprompt')) {
    console.log('  ✅ Install prompt logic found');
  } else {
    console.log('  ⚠️ Install prompt logic not found');
    warnings++;
  }
} else {
  console.log('  ❌ Component not found');
  errors++;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Summary\n');

if (errors === 0 && warnings === 0) {
  console.log('✅ PWA is READY for production!');
  console.log('\nNext steps:');
  console.log('  1. Deploy to production (HTTPS required)');
  console.log('  2. Run Lighthouse audit');
  console.log('  3. Test on mobile devices');
} else if (errors > 0) {
  console.log(`❌ PWA has ${errors} CRITICAL issue(s)`);
  if (warnings > 0) {
    console.log(`⚠️ And ${warnings} warning(s)`);
  }
  console.log('\nCritical issues must be fixed before deployment.');
  console.log('\nTo generate icons:');
  console.log('  1. Open scripts/create-basic-icons.html in browser');
  console.log('  2. Download all icon files');
  console.log('  3. Save to public/icons/');
  console.log('  4. Run this check again');
} else {
  console.log(`⚠️ PWA has ${warnings} warning(s)`);
  console.log('\nWarnings are optional but recommended to fix.');
  console.log('PWA should work, but may not be optimal.');
}

console.log('='.repeat(50) + '\n');

// Exit with error code if critical issues
process.exit(errors > 0 ? 1 : 0);
