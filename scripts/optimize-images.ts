/**
 * Batch Image Optimizer
 * Resizes images to 110% of their display context and converts to WebP.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/optimize-images.ts <directory> [context]
 *
 * Examples:
 *   npx ts-node scripts/optimize-images.ts photos/Produits product
 *   npx ts-node scripts/optimize-images.ts photos/Peptides product
 *   npx ts-node scripts/optimize-images.ts public/images/banners banner
 *   npx ts-node scripts/optimize-images.ts photos/Produits product --dry-run
 *   npx ts-node scripts/optimize-images.ts photos/Produits product --keep-originals
 *   npx ts-node scripts/optimize-images.ts photos/Produits product --format png
 */

import * as fs from 'fs';
import * as path from 'path';

// Display size targets (110% of max display)
const DISPLAY_SIZE_TARGETS: Record<string, { maxWidth: number; maxHeight: number }> = {
  product:   { maxWidth: 1056, maxHeight: 1056 },
  category:  { maxWidth: 1056, maxHeight: 704 },
  banner:    { maxWidth: 1320, maxHeight: 693 },
  avatar:    { maxWidth: 220, maxHeight: 220 },
  thumbnail: { maxWidth: 440, maxHeight: 440 },
  general:   { maxWidth: 1320, maxHeight: 1320 },
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.avif']);

async function main() {
  const args = process.argv.slice(2);
  const dirArg = args.find(a => !a.startsWith('--'));
  const context = args.find((a, i) => i > 0 && !a.startsWith('--')) || 'general';
  const dryRun = args.includes('--dry-run');
  const keepOriginals = args.includes('--keep-originals');
  const formatIdx = args.indexOf('--format');
  const formatArg = formatIdx >= 0 && args[formatIdx + 1] ? args[formatIdx + 1] : 'webp';

  if (!dirArg) {
    console.log('Usage: npx ts-node scripts/optimize-images.ts <directory> [context]');
    console.log('');
    console.log('Contexts: product, category, banner, avatar, thumbnail, general');
    console.log('Options: --dry-run, --keep-originals, --format <webp|jpeg|png>');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node scripts/optimize-images.ts photos/Produits product');
    console.log('  npx ts-node scripts/optimize-images.ts photos/Produits product --dry-run');
    process.exit(1);
  }

  const dir = path.isAbsolute(dirArg) ? dirArg : path.join(process.cwd(), dirArg);

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  const target = DISPLAY_SIZE_TARGETS[context] || DISPLAY_SIZE_TARGETS.general;

  // Load sharp
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharp = require('sharp');

  // Find all image files
  const files = fs.readdirSync(dir)
    .filter(f => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map(f => path.join(dir, f));

  if (files.length === 0) {
    console.log('No image files found in directory.');
    process.exit(0);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  IMAGE OPTIMIZER — 110% Display Rule`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  Directory:    ${dir}`);
  console.log(`  Context:      ${context}`);
  console.log(`  Target size:  ${target.maxWidth}×${target.maxHeight}px (110% of display)`);
  console.log(`  Output format: ${formatArg}`);
  console.log(`  Images found: ${files.length}`);
  console.log(`  Mode:         ${dryRun ? 'DRY RUN (no changes)' : keepOriginals ? 'Keep originals (.original)' : 'Replace in-place'}`);
  console.log(`${'═'.repeat(70)}\n`);

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  let processedCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const inputBuffer = fs.readFileSync(filePath);
    const originalSize = inputBuffer.length;
    totalOriginalSize += originalSize;

    // Get original dimensions
    const meta = await sharp(inputBuffer).metadata();
    const origW = meta.width || 0;
    const origH = meta.height || 0;

    // Check if already within target
    if (origW <= target.maxWidth && origH <= target.maxHeight && path.extname(filePath).toLowerCase() === `.${formatArg}`) {
      console.log(`  ⏭  ${fileName.padEnd(45)} ${origW}×${origH} — already optimal`);
      totalOptimizedSize += originalSize;
      skippedCount++;
      continue;
    }

    // Resize + convert
    let pipeline = sharp(inputBuffer)
      .resize(target.maxWidth, target.maxHeight, { fit: 'inside', withoutEnlargement: true })
      .rotate(); // Auto-rotate from EXIF then strip

    switch (formatArg) {
      case 'webp':
        pipeline = pipeline.webp({ quality: 85, effort: 4 });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality: 85, compressionLevel: 9 });
        break;
    }

    const outputBuffer = await pipeline.toBuffer();
    const outMeta = await sharp(outputBuffer).metadata();
    const newW = outMeta.width || 0;
    const newH = outMeta.height || 0;
    const savings = Math.round((1 - outputBuffer.length / originalSize) * 100);

    totalOptimizedSize += outputBuffer.length;

    const sizeStr = `${(originalSize / 1024).toFixed(0)}KB → ${(outputBuffer.length / 1024).toFixed(0)}KB`;
    const dimStr = `${origW}×${origH} → ${newW}×${newH}`;
    console.log(`  ✅ ${fileName.padEnd(45)} ${dimStr.padEnd(22)} ${sizeStr.padEnd(20)} -${savings}%`);

    if (!dryRun) {
      // Determine output path
      const ext = `.${formatArg}`;
      const baseName = path.basename(filePath, path.extname(filePath));
      const outputPath = path.join(dir, `${baseName}${ext}`);

      if (keepOriginals && filePath === outputPath) {
        // Rename original to .original
        fs.renameSync(filePath, `${filePath}.original`);
      }

      fs.writeFileSync(outputPath, outputBuffer);

      // Remove original if different extension and not keeping
      if (!keepOriginals && filePath !== outputPath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    processedCount++;
  }

  const totalSavings = totalOriginalSize - totalOptimizedSize;
  const totalSavingsPercent = totalOriginalSize > 0 ? Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100) : 0;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  SUMMARY`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`  Processed:    ${processedCount} images`);
  console.log(`  Skipped:      ${skippedCount} (already optimal)`);
  console.log(`  Original:     ${(totalOriginalSize / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  Optimized:    ${(totalOptimizedSize / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  Saved:        ${(totalSavings / (1024 * 1024)).toFixed(1)} MB (${totalSavingsPercent}%)`);
  console.log(`${'═'.repeat(70)}\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
