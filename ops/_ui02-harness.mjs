/* UI-02 前端行为 harness：在 Node VM 里真实执行 web/app.js（无构建原生 JS），
   用轻量 DOM + fetch stub 跑 viewReview 渲染与排期按钮点击，离线、不联网、不碰生产库。
   只做「已通过/待排期」这条 UI 路径的行为断言，不是完整浏览器验收。 */

import vm from 'node:vm';

// 从一段 HTML 里提取所有带 data-* 属性的标签（只关心这些，其余标签不影响断言）。
function parseTags(html) {
  const out = [];
  const re = /<[a-zA-Z][^>]*>/g;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const tagStr = m[0];
    const tm = tagStr.match(/^<(\w+)/);
    if (!tm) continue;
    const dataset = {};
    const ar = /data-([a-zA-Z0-9-]+)(?:="([^"]*)")?/g;
    let am;
    while ((am = ar.exec(tagStr))) dataset[am[1]] = am[2] !== undefined ? am[2] : '';
    if (Object.keys(dataset).length) out.push({ tag: tm[1].toLowerCase(), dataset });
  }
  return out;
}

export function runHarness(appJs, { routes, selectValue } = {}) {
  const fetchLog = [];
  const ids = new Map();
  const parsedEls = new Map(); // dataset 序列化 key -> 元素（保证 onclick 绑定与测试读取同一个对象）

  function makeElement(tag) {
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      _innerHTML: '',
      _parsed: [],
      textContent: '',
      className: '',
      disabled: false,
      value: '',
      checked: false,
      onclick: null,
      dataset: {},
      style: {},
      _attrs: {},
      children: [],
      setAttribute(k, v) { el._attrs[k] = String(v); },
      getAttribute(k) { return el._attrs[k] !== undefined ? el._attrs[k] : null; },
      appendChild(c) { el.children.push(c); return c; },
      addEventListener() {},
      classList: { toggle() {}, add() {}, remove() {} },
      closest() { return null; },
      set innerHTML(v) { el._innerHTML = String(v); el._parsed = parseTags(v); },
      get innerHTML() { return el._innerHTML; },
    };
    return el;
  }

  function register(id, el) { ids.set(id, el); }

  const viewEl = makeElement('section');
  register('view', viewEl);
  register('toast', makeElement('div'));
  register('nav', makeElement('nav'));
  register('btn-refresh', makeElement('button'));
  register('btn-tick', makeElement('button'));
  register('health', makeElement('span'));
  register('health-dot', makeElement('span'));
  register('badge-review', makeElement('span'));
  register('btn-theme', makeElement('button'));
  register('content', makeElement('div'));

  function datasetKey(ds) {
    return Object.keys(ds).sort().map((k) => `${k}=${ds[k]}`).join('&');
  }

  // 从 viewEl 的 parsed 标签集合里按 data-* 选择器匹配，并缓存元素。
  function queryParsed(sel) {
    const m = sel.match(/^\[data-([a-zA-Z0-9-]+)(?:="([^"]*)")?\]$/);
    if (!m) return [];
    const [, key, val] = m;
    const hits = viewEl._parsed.filter((p) => p.dataset[key] !== undefined && (val === undefined || p.dataset[key] === val));
    return hits.map((h) => {
      const k = datasetKey(h.dataset);
      if (!parsedEls.has(k)) {
        const el = makeElement(h.tag);
        el.dataset = { ...h.dataset };
        parsedEls.set(k, el);
      }
      const el = parsedEls.get(k);
      // select 的值：允许调用方按选择器注入
      if (typeof selectValue === 'function') {
        const v = selectValue(sel, el.dataset);
        if (v !== undefined) el.value = String(v);
      }
      return el;
    });
  }

  const document = {
    documentElement: makeElement('html'),
    querySelector(sel) {
      if (sel.startsWith('#')) return ids.get(sel.slice(1)) || makeElement('div');
      const hits = queryParsed(sel);
      return hits[0] || makeElement('div');
    },
    querySelectorAll(sel) {
      if (sel.startsWith('#')) return [ids.get(sel.slice(1)) || makeElement('div')];
      return queryParsed(sel);
    },
    createElement(tag) { return makeElement(tag); },
    getElementById(id) { return ids.get(id) || makeElement('div'); },
    addEventListener() {},
  };

  const localStorage = {
    _m: {},
    getItem(k) { return this._m[k] ?? null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  };

  const location = { hash: '#review', search: '', href: 'http://127.0.0.1:8795/' };
  const navigator = { clipboard: { writeText() { return Promise.resolve(); } } };

  async function fetch(url, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    let body = null;
    if (opts.body) { try { body = JSON.parse(opts.body); } catch { body = opts.body; } }
    fetchLog.push({ url, method, body });
    const route = routes ? routes(url, method, body) : null;
    if (route) {
      const { status = 200, data, text } = route;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data || {}),
        text: () => Promise.resolve(text !== undefined ? text : JSON.stringify(data || {})),
      };
    }
    return { ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('{}') };
  }

  const window = { devicePixelRatio: 1, addEventListener() {} };
  window.window = window;

  const ctx = {
    document, window, localStorage, location, navigator, fetch,
    console, setTimeout, clearTimeout, clearInterval, setInterval,
    URLSearchParams, URL, JSON, Promise, Math, Date, Number, String, Object, Array,
    RegExp, Error, Set, Map,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  vm.runInContext(appJs, ctx, { filename: 'web/app.js' });

  async function waitFor(fn, ms = 3000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 25));
    }
    return fn();
  }

  async function waitRendered() {
    await waitFor(() => viewEl._innerHTML.includes('待审') || viewEl._innerHTML.includes('已通过'));
    await new Promise((r) => setTimeout(r, 60));
  }

  // 拿到已绑定 onclick 的 data-sch2 按钮（与 VM 内绑定的同一个对象）
  function sch2Buttons() {
    return queryParsed('[data-sch2]');
  }
  function acc2Selects() {
    return queryParsed('[data-acc2]');
  }
  function when2Inputs() {
    return queryParsed('[data-when2]');
  }

  return { ctx, fetchLog, viewEl, document, waitRendered, sch2Buttons, acc2Selects, when2Inputs, viewReview: () => ctx.viewReview(), go: (v) => ctx.go(v) };
}
