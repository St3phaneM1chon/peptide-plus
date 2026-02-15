#!/usr/bin/env node
/**
 * Verification Script for Review Photos Feature
 * Run: node verify-review-photos.js
 */

const fs = require('fs');
const path = require('path');

const checks = [];
const errors = [];

function check(name, test, errorMsg) {
  try {
    const result = test();
    checks.push({ name, passed: result });
    if (!result && errorMsg) {
      errors.push(`❌ ${name}: ${errorMsg}`);
    }
  } catch (e) {
    checks.push({ name, passed: false });
    errors.push(`❌ ${name}: ${e.message}`);
  }
}

console.log('🔍 Verifying Review Photos Implementation...\n');

// Check files exist
check(
  'Upload API route exists',
  () => fs.existsSync('./src/app/api/reviews/upload/route.ts'),
  'File not found: src/app/api/reviews/upload/route.ts'
);

check(
  'Reviews API route exists',
  () => fs.existsSync('./src/app/api/reviews/route.ts'),
  'File not found: src/app/api/reviews/route.ts'
);

check(
  'ReviewImageUpload component exists',
  () => fs.existsSync('./src/components/shop/ReviewImageUpload.tsx'),
  'File not found: src/components/shop/ReviewImageUpload.tsx'
);

check(
  'ReviewImageGallery component exists',
  () => fs.existsSync('./src/components/shop/ReviewImageGallery.tsx'),
  'File not found: src/components/shop/ReviewImageGallery.tsx'
);

check(
  'ProductReviews component exists',
  () => fs.existsSync('./src/components/shop/ProductReviews.tsx'),
  'File not found: src/components/shop/ProductReviews.tsx'
);

// Check uploads directory
check(
  'Uploads directory exists',
  () => fs.existsSync('./public/uploads/reviews'),
  'Directory not found: public/uploads/reviews'
);

check(
  'Uploads directory is writable',
  () => {
    const testFile = './public/uploads/reviews/.write-test';
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  },
  'Directory not writable: public/uploads/reviews'
);

// Check schema
check(
  'Prisma schema contains ReviewImage model',
  () => {
    const schema = fs.readFileSync('./prisma/schema.prisma', 'utf8');
    return schema.includes('model ReviewImage');
  },
  'ReviewImage model not found in schema.prisma'
);

check(
  'Review model has images relation',
  () => {
    const schema = fs.readFileSync('./prisma/schema.prisma', 'utf8');
    return schema.includes('images      ReviewImage[]');
  },
  'Review model missing images relation'
);

// Check gitignore
check(
  '.gitignore excludes uploads',
  () => {
    const gitignore = fs.readFileSync('./.gitignore', 'utf8');
    return gitignore.includes('public/uploads/');
  },
  'public/uploads/ not in .gitignore'
);

// Check API route structure
check(
  'Upload route has dynamic export',
  () => {
    const content = fs.readFileSync('./src/app/api/reviews/upload/route.ts', 'utf8');
    return content.includes("export const dynamic = 'force-dynamic'");
  },
  'Missing: export const dynamic = \'force-dynamic\''
);

check(
  'Reviews route has dynamic export',
  () => {
    const content = fs.readFileSync('./src/app/api/reviews/route.ts', 'utf8');
    return content.includes("export const dynamic = 'force-dynamic'");
  },
  'Missing: export const dynamic = \'force-dynamic\''
);

// Check component imports
check(
  'ProductReviews imports ReviewImageUpload',
  () => {
    const content = fs.readFileSync('./src/components/shop/ProductReviews.tsx', 'utf8');
    return content.includes('ReviewImageUpload');
  },
  'ProductReviews does not import ReviewImageUpload'
);

check(
  'ProductReviews imports ReviewImageGallery',
  () => {
    const content = fs.readFileSync('./src/components/shop/ProductReviews.tsx', 'utf8');
    return content.includes('ReviewImageGallery');
  },
  'ProductReviews does not import ReviewImageGallery'
);

check(
  'ProductReviews imports toast',
  () => {
    const content = fs.readFileSync('./src/components/shop/ProductReviews.tsx', 'utf8');
    return content.includes("import { toast } from 'sonner'");
  },
  'ProductReviews missing toast import'
);

// Summary
console.log('📊 Results:\n');
const passed = checks.filter(c => c.passed).length;
const total = checks.length;

checks.forEach(({ name, passed }) => {
  console.log(`${passed ? '✅' : '❌'} ${name}`);
});

console.log(`\n${passed}/${total} checks passed\n`);

if (errors.length > 0) {
  console.log('❌ Errors found:\n');
  errors.forEach(err => console.log(err));
  console.log('\n');
  process.exit(1);
} else {
  console.log('✅ All checks passed! Review photos feature is ready.\n');
  console.log('Next steps:');
  console.log('1. Test the upload functionality in development');
  console.log('2. Submit a test review with images');
  console.log('3. Verify admin panel displays images correctly');
  console.log('4. Check the "With Photos" filter works');
  console.log('5. Test the lightbox gallery\n');
}
