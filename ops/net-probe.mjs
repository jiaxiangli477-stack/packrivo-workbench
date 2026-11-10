const ua = { 'user-agent': 'web:packrivo-workbench:0.2 (by /u/packrivo)' };
async function t(url, name) {
  try {
    const r = await fetch(url, { headers: ua });
    const txt = await r.text();
    console.log(name, 'status', r.status, 'len', txt.length, 'head', txt.slice(0, 120).replace(/\s+/g, ' '));
  } catch (e) { console.log(name, 'ERR', e.message); }
}
await t('https://www.reddit.com/search.json?q=custom%20packaging&sort=top&t=month&limit=3', 'reddit');
await t('https://html.duckduckgo.com/html/?q=packaging+trends+2026', 'ddg');
await t('https://hn.algolia.com/api/v1/search?query=packaging&tags=story', 'hn');