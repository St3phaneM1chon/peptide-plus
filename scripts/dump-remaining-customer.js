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
const skip = ['admin'];
const allNs = Object.keys(en).filter(n => !skip.includes(n) && !n.startsWith('crm'));
let total = 0;
for (const n of allNs) {
  const keys = unt(en[n], ar[n], n);
  const entries = Object.entries(keys);
  if (entries.length > 0) {
    console.log('=== ' + n + ' (' + entries.length + ') ===');
    for (const [k, v] of entries) console.log('  ' + k + ' = ' + JSON.stringify(v));
    total += entries.length;
  }
}
console.log('\nTOTAL customer-facing remaining: ' + total);
