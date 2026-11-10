import { readFileSync, writeFileSync } from 'node:fs';
const p = 'E:/破甲工作区/social-workbench/app/browser.mjs';
let c = readFileSync(p, 'utf8');
const done = [];
const rep = (n, a, b) => { if (!c.includes(a)) { console.log('MISS', n); return; } c = c.replace(a, b); done.push(n); };

/* 抓 ASIN + 月销 + 评价数，并把赞助跳转链接换成 /dp/ 正式链接 */
rep('amazon-extract',
  `        return {
          title: (c.querySelector('h2')?.innerText || '').trim(),
          price: (c.querySelector('.a-price .a-offscreen')?.textContent || '').trim(),
          rating: (c.querySelector('.a-icon-alt')?.textContent || '').trim(),
          reviews: rev || ((txt.match(/([\\d,]+)\\s*ratings?/i) || [])[1] || ''),
          bought,
          img: c.querySelector('img.s-image')?.src || '',
          url: c.querySelector('a.a-link-normal')?.href || '',
        };`,
  `        return {
          asin: c.getAttribute('data-asin') || '',
          title: (c.querySelector('h2')?.innerText || '').trim(),
          price: (c.querySelector('.a-price .a-offscreen')?.textContent || '').trim(),
          rating: (c.querySelector('.a-icon-alt')?.textContent || '').trim(),
          reviews: (c.querySelector('a[href*="#customerReviews"] span')?.textContent || rev || ((txt.match(/([\\d,]+)\\s*ratings?/i) || [])[1] || '')).trim(),
          bought,
          img: c.querySelector('img.s-image')?.src || '',
          url: c.getAttribute('data-asin') ? 'https://www.amazon.com/dp/' + c.getAttribute('data-asin') : (c.querySelector('a.a-link-normal')?.href || ''),
        };`);

rep('amazon-map',
  `        url: x.url,`,
  `        url: x.url,
        asin: x.asin,`);

writeFileSync(p, c, 'utf8');
console.log('done:', done.join(', '));
