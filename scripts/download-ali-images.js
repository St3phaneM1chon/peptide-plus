#!/usr/bin/env node
/**
 * Download product images from AliExpress search results
 * Usage: node scripts/download-ali-images.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Products without images and their AliExpress search terms
const products = [
  { slug: 'vortex-mixer-compact-3000rpm', search: 'laboratory vortex mixer 3000rpm compact' },
  { slug: 'vortex-mixer-portable-westtune', search: 'WESTTUNE vortex mixer portable laboratory' },
  { slug: 'agitateur-magnetique-sans-chauffage', search: 'magnetic stirrer without heating laboratory' },
  { slug: 'agitateur-orbital-paillasse', search: 'orbital shaker laboratory benchtop' },
  { slug: 'agitateur-basculeur-rocker-2d', search: 'laboratory rocker shaker 2D platform' },
  { slug: 'agitateur-flacons-erlenmeyer', search: 'erlenmeyer flask shaker laboratory orbital' },
  { slug: 'bain-marie-laboratoire-2l', search: 'laboratory water bath 2L digital thermostatic' },
  { slug: 'bain-ultrasonique-3l-40khz', search: 'ultrasonic cleaner bath 3L 40kHz laboratory' },
  { slug: 'balance-analytique-0001g-200g', search: 'analytical balance 0.001g 200g laboratory' },
  { slug: 'balance-precision-001g-5kg', search: 'precision balance 0.01g 5kg laboratory' },
  { slug: 'bloc-chauffant-digital-dry-bath', search: 'digital dry bath incubator laboratory block heater' },
  { slug: 'mini-centrifugeuse-pcr-microtubes', search: 'mini centrifuge PCR microtubes laboratory 10000rpm' },
  { slug: 'shaker-plaques-96-puits', search: 'microplate shaker 96 well laboratory' },
  { slug: 'incubateur-agite-plaques', search: 'incubating shaker microplate laboratory' },
  { slug: 'incubateur-bacterien-37c-20l', search: 'bacteria incubator 37C 20L laboratory' },
  { slug: 'incubateur-refrigere-5-50c', search: 'refrigerated incubator 5-50C laboratory' },
  { slug: 'four-sechage-laboratoire', search: 'laboratory drying oven electric heating' },
  { slug: 'etuve-sechage-grande-capacite', search: 'laboratory large drying oven forced air' },
  { slug: 'rotateur-tubes-360', search: 'tube rotator 360 degree laboratory' },
  { slug: 'compteur-colonies-digital', search: 'digital colony counter laboratory bacteria' },
  { slug: 'lampe-uv-sterilisation-254nm', search: 'UV sterilization lamp 254nm laboratory germicidal' },
  { slug: 'congelateur-laboratoire-moins20-90l', search: 'laboratory freezer -20C 90L mini' },
  { slug: 'refrigerateur-laboratoire-2-8c-100l', search: 'laboratory refrigerator 2-8C 100L medical' },
  { slug: 'hotte-flux-laminaire-table', search: 'laminar flow hood benchtop laboratory clean' },
  { slug: 'hotte-chimique-fume-hood', search: 'small fume hood laboratory chemical' },
  { slug: 'hotte-sans-conduit-filtration', search: 'ductless fume hood filtration laboratory' },
  { slug: 'pompe-a-vide-laboratoire', search: 'vacuum pump laboratory diaphragm oil-free' },
  { slug: 'pompe-peristaltique-1-canal', search: 'peristaltic pump single channel laboratory' },
  { slug: 'kit-filtration-sous-vide-1000ml', search: 'vacuum filtration kit 1000ml laboratory glass' },
  { slug: 'distillateur-eau-compact', search: 'water distiller compact laboratory 4L' },
  { slug: 'distillateur-eau-laboratoire-4lh', search: 'water distiller laboratory 4L/h stainless steel' },
  { slug: 'microscope-binoculaire-40-1500x', search: 'binocular microscope 40x-1500x laboratory biological' },
  { slug: 'microscope-numerique-camera-usb-hdmi', search: 'digital microscope camera USB HDMI laboratory' },
  { slug: 'spectrophotometre-uv-visible', search: 'UV visible spectrophotometer laboratory' },
  { slug: 'spectrophotometre-uv-vis-simple-faisceau', search: 'single beam UV-Vis spectrophotometer laboratory' },
  { slug: 'lecteur-microplaques-full-wavelength', search: 'microplate reader full wavelength ELISA laboratory' },
  { slug: 'stereomicroscope-binoculaire-20-40x', search: 'stereo microscope binocular 20x-40x laboratory' },
  { slug: 'stereomicroscope-industriel-35-90x', search: 'stereo microscope zoom 3.5x-90x trinocular industrial' },
];

console.log(`Processing ${products.length} products...`);
console.log(JSON.stringify(products.map(p => p.slug)));
