const base='http://127.0.0.1:8787/v1';
const msgs=[{role:'user',content:'只输出 JSON：{"score":0-100,"decision":"approve|reject","issues":["..."],"reason":"一句话"}。评估文案：Custom kraft mailer box, one-sheet, no tape, MOQ 500.'}];
for (const model of ['step-5-preview','deepseek-v4.1-flash']) {
  for (const mt of [1500, 3000]) {
    const r = await fetch(base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,messages:msgs,temperature:0.2,max_tokens:mt,stream:false})});
    const d = await r.json();
    const m = d?.choices?.[0]?.message||{};
    console.log(model,'max_tokens',mt,'finish=',d?.choices?.[0]?.finish_reason,
      'len(content)=',(m.content||'').length,'len(reasoning)=',(m.reasoning_content||'').length);
    console.log('  content head:', JSON.stringify((m.content||'').slice(0,160)));
  }
}