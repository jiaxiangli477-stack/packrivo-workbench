const base='http://127.0.0.1:8787/v1';
const msgs=[{role:'user',content:'给这条社媒文案打分。只输出 JSON：{"score":0-100,"decision":"approve|reject","issues":["..."],"reason":"一句话"}。文案：Custom kraft mailer box, one-sheet, no tape, MOQ 500.'}];
for (const model of ['step-5-preview','deepseek-v4.1-flash','space-bunny']) {
  try {
    const r = await fetch(base+'/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,messages:msgs,temperature:0.2,max_tokens:400,stream:false})});
    const t = await r.text();
    let d={}; try{d=JSON.parse(t)}catch{}
    const m=d?.choices?.[0]?.message||{};
    console.log('===',model,'status',r.status,'===');
    console.log('content:', JSON.stringify((m.content||'').slice(0,300)));
    console.log('reasoning:', JSON.stringify((m.reasoning_content||'').slice(0,200)));
  } catch(e){ console.log('===',model,'ERR',e.message); }
}