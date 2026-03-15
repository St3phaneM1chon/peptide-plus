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
const ns = ['help', 'security', 'demo', 'clients', 'caseStudies', 'catalogue',
  'provinces', 'formats', 'units', 'giftCard', 'learn', 'mobile',
  'ownerDashboard', 'socialProof', 'references', 'consentType', 'contentType',
  'contentVisibility', 'questionType', 'customerAddresses', 'customerRewards',
  'rsde', 'video', 'videoSource', 'videoStatus', 'videos', 'voip', 'webinars',
  'tts', 'dashboard', 'badges', 'cookies', 'currency', 'profile', 'labResults'];
for (const n of ns) {
  const keys = unt(en[n], ar[n], n);
  const entries = Object.entries(keys);
  if (entries.length > 0) {
    console.log('=== ' + n + ' (' + entries.length + ') ===');
    for (const [k, v] of entries) console.log(k + ' = ' + v);
  }
}
