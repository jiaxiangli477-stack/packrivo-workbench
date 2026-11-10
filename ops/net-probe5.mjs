const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };
async function probe(name, url) {
  try {
    const r = await fetch(url, { headers });
    const t = await r.text();
    const items = [...t.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<link>([^<]+)<\/link>/g)].slice(0, 4);
    console.log(name, r.status, 'len', t.length, 'items', items.length);
    items.forEach((m) => console.log('   -', m[1].slice(0, 80).replace(/\s+/g, ' '), '|', m[2].slice(0, 70)));
  } catch (e) { console.log(name, 'ERR', e.message); }
}
await probe('reddit-rss', 'https://www.reddit.com/search.rss?q=custom%20mailer%20box&sort=top&t=month');
await probe('gnews-rss', 'https://news.google.com/rss/search?q=packaging+trends&hl=en-US&gl=US&ceid=US:en');
await probe('bingnews-rss', 'https://www.bing.com/news/search?q=packaging&format=RSS');