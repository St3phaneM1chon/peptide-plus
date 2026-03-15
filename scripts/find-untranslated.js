const en = require('../src/i18n/locales/en.json');
const ar = require('../src/i18n/locales/ar.json');

function countSame(enObj, arObj) {
  let count = 0;
  if (!enObj || !arObj) return 0;
  for (const k of Object.keys(enObj)) {
    if (typeof enObj[k] === 'string') {
      if (arObj[k] === enObj[k]) count++;
    } else if (typeof enObj[k] === 'object' && enObj[k] !== null && !Array.isArray(enObj[k])) {
      count += countSame(enObj[k], arObj[k]);
    }
  }
  return count;
}

const namespaces = Object.keys(en);
for (const ns of namespaces) {
  const same = countSame(en[ns], ar[ns]);
  if (same > 2) {
    console.log(ns + ': ' + same + ' untranslated');
  }
}
