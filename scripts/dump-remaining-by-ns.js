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
const ns = process.argv[2] ? process.argv[2].split(',') : [];
for (const n of ns) {
  const keys = unt(en[n], ar[n], n);
  for (const [k, v] of Object.entries(keys)) console.log(k + ' = ' + JSON.stringify(v));
}
