const H = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };
async function t(name, url) {
  try {
    const r = await fetch(url, { headers: H });
    const s = await r.text();
    console.log('===', name, r.status, 'len', s.length);
    console.log(s.slice(0, 300).replace(/\s+/g, ' '));
  } catch (e) { console.log('===', name, 'ERR', e.message); }
}
await t('pullpush-reddit', 'https://api.pullpush.io/reddit/search/submission/?q=packaging&size=3&sort=desc&sort_type=score');
await t('packrivo', 'https://packrivo.com');
await t('packhelp', 'https://packhelp.com');