import { all, setting } from './db.mjs';
import { decrypt } from './crypto.mjs';

const BUILTIN_BASE = process.env.SWB_GW || 'http://127.0.0.1:8787/v1';

function taskModelMap() {
  try {
    return JSON.parse(setting('llm_task_models') || '{}');
  } catch {
    return {};
  }
}

function enabledEndpoints() {
  return all("select * from model_endpoint where enabled = 1 and kind = 'text' order by priority asc, id asc");
}

function candidates(task, overrideModel) {
  const map = taskModelMap();
  const want = overrideModel || map[task] || '';
  const out = [];
  if (want) out.push({ base: BUILTIN_BASE, model: want, key: '', source: `任务映射(${task})` });
  for (const e of enabledEndpoints()) {
    out.push({ base: e.base_url.replace(/\/$/, ''), model: e.model, key: e.api_key_cipher ? decrypt(e.api_key_cipher) : '', source: `接口(${e.name})` });
  }
  out.push({ base: BUILTIN_BASE, model: want || 'deepseek-v4.1-flash', key: '', source: '内置网关' });
  return out;
}

async function callOnce({ base, model, key, messages, temperature, maxTokens, timeoutMs }) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs || 180000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ model, messages, temperature: temperature ?? 0.7, max_tokens: maxTokens ?? 1600, stream: false }),
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    const msg = data?.choices?.[0]?.message || {};
    const content = msg.content || msg.reasoning_content || '';
    if (!content.trim()) throw new Error('空响应');
    return { content, usage: data.usage || null, model: data.model || model };
  } finally {
    clearTimeout(t);
  }
}

export async function chat({ task = 'rewrite', model = '', messages, temperature, maxTokens }) {
  const errors = [];
  for (const c of candidates(task, model)) {
    try {
      const r = await callOnce({ ...c, messages, temperature, maxTokens });
      return { ...r, via: c.source };
    } catch (e) {
      errors.push(`${c.source}/${c.model}: ${e.message}`);
    }
  }
  throw new Error('全部模型不可用：' + errors.join(' | '));
}

export async function testEndpoint(base, model, key) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  try {
    const res = await fetch(`${String(base).replace(/\/$/, '')}/models`, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
      signal: ac.signal,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${text.slice(0, 200)}` };
    let models = [];
    try {
      models = (JSON.parse(text).data || []).map((m) => m.id);
    } catch {}
    return { ok: true, models: models.slice(0, 50), model_ok: model ? models.includes(model) || models.length === 0 : true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

export async function pingBuiltin() {
  try {
    const res = await fetch(`${BUILTIN_BASE}/models`);
    const data = await res.json();
    return { ok: res.ok, models: (data.data || []).map((m) => m.id) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
