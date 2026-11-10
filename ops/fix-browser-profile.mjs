import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/browser.mjs';
let c = readFileSync(p, 'utf8');

/* 1) 换成持久化 profile：一次人机验证后复用 cookie */
c = c.replace(
  `let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
  }
  return browserPromise;
}`,
  `import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROFILE = join(process.cwd(), 'data', 'browser-profile');
mkdirSync(PROFILE, { recursive: true });

let browserPromise = null;
async function getContext(headless = true) {
  if (!browserPromise) {
    browserPromise = chromium.launchPersistentContext(PROFILE, {
      channel: 'msedge',
      headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      userAgent: UA,
      locale: 'en-US',
      viewport: { width: 1366, height: 900 },
    });
  }
  return browserPromise;
}`
);

c = c.replace(
  `async function withPage(fn) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await ctx.close().catch(() => {});
  }
}`,
  `async function withPage(fn, headless = true) {
  const ctx = await getContext(headless);
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); }).catch(() => {});
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

/* 打开一个有头窗口，让用户手动过一次阿里人机验证；cookie 存进 profile */
export async function warmupAlibaba(keyword = 'jewelry gift box') {
  await closeBrowser();
  const slug = String(keyword).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return withPage(async (page) => {
    await page.goto(\`https://www.alibaba.com/showroom/\${slug}.html\`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      const n = await page.$$eval('a[href*="product-detail"]', (as) => as.length).catch(() => 0);
      if (n > 0) return { ok: true, links: n };
      await page.waitForTimeout(3000);
    }
    return { ok: false, links: 0 };
  }, false);
}`
);

c = c.replace(
  `export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => {});
  }
}`,
  `export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => {});
  }
}`
);

writeFileSync(p, c, 'utf8');
console.log('browser persistent profile wired');
