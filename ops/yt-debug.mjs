const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const html = await (await fetch('https://www.youtube.com/results?search_query=custom+mailer+box&sp=EgIQAQ%253D%253D',{headers:{'user-agent':UA,'accept-language':'en-US,en;q=0.9'}})).text();
const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
const data = JSON.parse(m[1]);
let found=0;
const walk=(n,d=0)=>{ if(!n||typeof n!=='object'||d>12||found>=2) return;
  if(Array.isArray(n)) return n.forEach(x=>walk(x,d+1));
  const v=n.videoRenderer;
  if(v&&v.videoId&&found<2){
    found++;
    console.log('KEYS:', Object.keys(v).join(','));
    console.log('title:', (v.title?.runs||[]).map(r=>r.text).join(''));
    console.log('publishedTimeText:', JSON.stringify(v.publishedTimeText));
    console.log('viewCountText:', JSON.stringify(v.viewCountText));
    console.log('detailedMetadataSnippets:', JSON.stringify(v.detailedMetadataSnippets)?.slice(0,200));
  }
  Object.values(n).forEach(x=>walk(x,d+1));
};
walk(data);