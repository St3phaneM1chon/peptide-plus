const en = require('../src/i18n/locales/en.json');
const ar = require('../src/i18n/locales/ar.json');
function unt(e, a, p) {
  let r = {};
  if (!e || !a) return r;
  for (const k of Object.keys(e)) {
    const key = p ? p + '.' + k : k;
    if (typeof e[k] === 'string') {
      if (a[k] === e[k]) r[key] = e[k];
    } else if (typeof e[k] === 'object' && e[k] !== null && !Array.isArray(e[k])) {
      Object.assign(r, unt(e[k], a[k] || {}, key));
    }
  }
  return r;
}
// Check ALL namespaces
const allNs = Object.keys(en);
let total = 0;
for (const n of allNs) {
  const keys = unt(en[n], ar[n], n);
  const entries = Object.entries(keys);
  if (entries.length > 0) {
    console.log('=== ' + n + ' (' + entries.length + ') ===');
    for (const [k, v] of entries) console.log('  ' + k);
    total += entries.length;
  }
}
console.log('\nTOTAL remaining: ' + total);
