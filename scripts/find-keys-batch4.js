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
['chat', 'community', 'calculator', 'ambassador', 'blog', 'upsell', 'share', 'rewards', 'priceAlert', 'compare', 'bundles'].forEach(n => {
  const keys = unt(en[n], ar[n], n);
  Object.entries(keys).forEach(([k, v]) => console.log(k + ' = ' + v));
});
