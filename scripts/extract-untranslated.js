const en = require('../src/i18n/locales/en.json');
const ar = require('../src/i18n/locales/ar.json');

function getUntranslated(enObj, arObj, prefix) {
  const result = {};
  if (!enObj || !arObj) return result;
  for (const k of Object.keys(enObj)) {
    const key = prefix ? prefix + '.' + k : k;
    if (typeof enObj[k] === 'string') {
      if (arObj[k] === enObj[k]) result[key] = enObj[k];
    } else if (typeof enObj[k] === 'object' && enObj[k] !== null && !Array.isArray(enObj[k])) {
      Object.assign(result, getUntranslated(enObj[k], arObj[k], key));
    }
  }
  return result;
}

const ns = ['shop','common','cart','auth','nav','footer','home','toast','search','consent','checkout','errors','pwa','disclaimer'];
for (const n of ns) {
  const keys = getUntranslated(en[n], ar[n], '');
  const entries = Object.entries(keys);
  if (entries.length > 0) {
    console.log('=== ' + n + ' (' + entries.length + ' keys) ===');
    for (const [k, v] of entries) {
      console.log(k + ' ||| ' + JSON.stringify(v));
    }
    console.log('');
  }
}
