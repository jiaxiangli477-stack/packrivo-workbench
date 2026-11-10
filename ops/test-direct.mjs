import { channels } from '../app/channels.mjs';
const content = { title: 'Test', body: 'hello world', hashtags: '#test' };
for (const k of ['mastodon', 'bluesky']) {
  try {
    const r = await channels[k].publish({ content, account: { id: 999, handle: '@nobody', platform: k }, platform: k });
    console.log(k, 'unexpected ok', r);
  } catch (e) {
    console.log(k, '->', e.code || e.name, '|', e.message);
  }
}