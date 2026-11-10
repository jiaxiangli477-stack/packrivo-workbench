import { auditContent } from '../app/quality.mjs';
const rad = await (await fetch('http://127.0.0.1:8795/api/radar')).json();
const r = rad.radar;
const out = await auditContent({ category: r.category, videos: r.videos, posts: r.posts, articles: r.articles });
console.log('items', out.items.length, 'via', out.via);
console.log('summary', out.summary);
console.log(JSON.stringify(out.items.slice(0,3)));