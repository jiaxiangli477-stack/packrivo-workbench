const urls = [
  'https://i.ytimg.com/vi/RTzIitEz5ec/mqdefault.jpg',
  'https://www.google.com/s2/favicons?domain=packhelp.com&sz=64',
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const b = await r.arrayBuffer();
    console.log(u.slice(0, 60), r.status, r.headers.get('content-type'), b.byteLength + 'B');
  } catch (e) { console.log(u.slice(0, 60), 'ERR', e.message); }
}