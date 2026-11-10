import { searchYouTube } from '../app/sources.mjs';
const items = await searchYouTube('custom jewelry boxes with logo', 20);
console.log('items', items.length, 'days:', items.map(i => i.days).join(','));