const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
async function probe(name, url, headers = {}) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'en-US,en;q=0.9', ...headers } });
    const t = await r.text();
    console.log('===', name, r.status, 'len', t.length, 'ctype', r.headers.get('content-type'));
    console.log(t.slice(0, 220).replace(/\s+/g, ' '));
  } catch (e) { console.log('===', name, 'ERR', e.message); }
}
const data = encodeURIComponent(JSON.stringify({ options: { query: 'packaging', scope: 'pins' }, context: {} }));
await probe('pinterest', `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F%3Fq%3Dpackaging&data=${data}`, { 'x-requested-with': 'XMLHttpRequest', 'x-pinterest-appstate': 'active' });
await probe('pixelfed', 'https://pixelfed.social/api/v1/timelines/tag/packaging?limit=3');
await probe('tumblr', 'https://www.tumblr.com/api/v2/tagged?tag=packaging&limit=3');