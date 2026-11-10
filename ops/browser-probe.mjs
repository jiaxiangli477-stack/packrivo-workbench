import { chromium } from 'playwright-core';
import { readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROFILE = join(process.cwd(), 'data', 'browser-profile');
for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile']) {
  const p = join(PROFILE, f);
  if (existsSync(p)) { try { rmSync(p, { force: true }); console.log('删除锁', f); } catch (e) { console.log('删锁失败', f, e.message); } }
}

for (const headless of [true, false]) {
  try {
    const t0 = Date.now();
    const ctx = await chromium.launchPersistentContext(PROFILE, {
      channel: 'msedge',
      headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const page = ctx.pages()[0] || (await ctx.newPage());
    await page.goto('https://www.amazon.com/s?k=jewelry+box', { waitUntil: 'domcontentloaded', timeout: 40000 });
    const title = await page.title();
    console.log(`headless=${headless} OK ${((Date.now() - t0) / 1000).toFixed(1)}s title=${title.slice(0, 60)}`);
    await ctx.close();
    break;
  } catch (e) {
    console.log(`headless=${headless} 失败: ${String(e.message).split('\n')[0].slice(0, 160)}`);
  }
}
