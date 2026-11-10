const urls = [
  'https://www.packrivo.com/product-drawer-jewelry-box/',
  'https://www.packrivo.com/product-magnetic-jewelry-box/',
  'https://www.packrivo.com/product-jewelry-box-with-insert/',
  'https://www.packrivo.com/product-lid-and-base-jewelry-box/',
  'https://www.packrivo.com/product-collapsible-magnetic-gift-box/',
  'https://www.packrivo.com/product-window-lid-rigid-gift-box/',
  'https://www.packrivo.com/textile-jewelry-pouch/',
  'https://www.packrivo.com/molded-pulp-insert/',
  'https://www.packrivo.com/mailer-boxes/',
  'https://www.packrivo.com/jewelry-boxes/',
  'https://www.packrivo.com/foldable-gift-boxes/',
  'https://www.packrivo.com/inserts/',
  'https://www.packrivo.com/bags-pouches/',
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA } });
    const html = await r.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,300})/i) || [])[1] || '';
    const h1 = (html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i) || [])[1] || '';
    const clean = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    console.log(JSON.stringify({ url: u, status: r.status, title: clean(title).slice(0, 120), h1: clean(h1).slice(0, 100), desc: clean(desc).slice(0, 200) }));
  } catch (e) {
    console.log(JSON.stringify({ url: u, status: 'ERR', error: e.message }));
  }
}
