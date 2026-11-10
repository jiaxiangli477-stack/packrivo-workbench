const KEY = 'e77fa996b6a61d4d15fbe4d63ebeab8ef8ab0c86755e3a4977213419df87348f';
const BASE = 'https://api.postiz.com/public/v1';

async function probe(label, method, path, { auth = true, body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(auth ? { authorization: KEY } : {}), ...headers },
    body,
  });
  const text = await res.text();
  console.log(`\n=== ${label} ${method} ${path} ===`);
  console.log('status =', res.status);
  console.log('headers =', JSON.stringify({ 'content-type': res.headers.get('content-type'), 'retry-after': res.headers.get('retry-after'), 'x-powered-by': res.headers.get('x-powered-by') }));
  console.log('body =', text.slice(0, 400));
  return { status: res.status, text };
}

// 1) integrations 无 key
let r = await fetch(BASE + '/integrations');
console.log('\n=== integrations (no auth) ===');
console.log('status =', r.status, 'body =', (await r.text()).slice(0, 200));

// 2) integrations 无效 key
await probe('integrations', 'GET', '/integrations');

// 3) upload 无效 key（1x1 png）
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const fd = new FormData();
fd.append('file', new Blob([png], { type: 'image/png' }), 'probe.png');
await probe('upload', 'POST', '/upload', { body: fd });

// 4) posts 无效 key
await probe('posts', 'POST', '/posts', {
  body: JSON.stringify({ type: 'now', date: new Date().toISOString(), posts: [{ integration: { id: 'x' }, value: [{ content: 'Packrivo cloud-link probe (test-only, no publish)' }] }] }),
  headers: { 'content-type': 'application/json' },
});
