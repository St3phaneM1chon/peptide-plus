import { scrapeGoogleMaps } from '../src/lib/scraper/google-maps-playwright';

async function main() {
  console.log('Testing Playwright Google Maps Scraper — 10 results with email crawl');
  console.log('Query: garage | Location: Montreal | Max: 10 | Crawl: ON');
  console.log('---');

  const start = Date.now();
  const results = await scrapeGoogleMaps({
    query: 'garage',
    location: 'Montreal',
    maxResults: 10,
    crawlWebsites: true,
    scrollTimeout: 20000,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const emailCount = results.filter((r) => r.email).length;

  console.log(`\nFound ${results.length} results in ${elapsed}s (${emailCount} emails):\n`);

  for (const place of results) {
    console.log(`  ${place.name}`);
    console.log(`    Addr: ${place.address || '—'} | City: ${place.city || '—'} | ${place.province || ''} ${place.postalCode || ''}`);
    console.log(`    Tel:  ${place.phone || '—'} | Email: ${place.email || '—'}`);
    console.log(`    Web:  ${place.website || '—'}`);
    console.log(`    Rating: ${place.googleRating ?? '—'}/5 (${place.googleReviewCount ?? 0} avis) | Cat: ${place.category || '—'}`);
    console.log(`    GPS: ${place.latitude}, ${place.longitude}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
