const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept-language': 'en-US,en;q=0.9' };
const r = await fetch('https://www.bing.com/search?q=custom+mailer+box+trends&setlang=en', { headers });
const t = await r.text();
const blocks = [...t.matchAll(/<li class="b_algo"[\s\S]{0,4000}?<\/li>/g)].slice(0, 5);
console.log('blocks', blocks.length);
for (const b of blocks.slice(0,3)) {
  const s = b[0];
  const a = s.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]{0,160}?)<\/a>/);
  const p = s.match(/<p[^>]*>([\s\S]{0,200}?)<\/p>/);
  console.log('--', a ? a[2].replace(/<[^>]+>/g,'') : '?', '|', a ? a[1].slice(0,90) : '?');
  console.log('   snip:', p ? p[1].replace(/<[^>]+>/g,'').slice(0,120) : '?');
}