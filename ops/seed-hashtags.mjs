import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/破甲工作区/social-workbench/data/workbench.db');

db.exec(`create table if not exists hashtag (
  id integer primary key autoincrement,
  platform text not null,
  tag text not null,
  tier text not null default 'niche',
  weight integer not null default 50,
  note text default '',
  created_at text not null default (datetime('now')),
  unique(platform, tag)
);`);

const seed = [
  // Bluesky：设计/采购人群，标签字数少、垂类为主
  ['bluesky', '#PackagingDesign', 'broad', 70, '设计话题，量中等'],
  ['bluesky', '#Packaging', 'broad', 60, '大词，竞争激烈'],
  ['bluesky', '#JewelryPackaging', 'niche', 80, '垂类精准'],
  ['bluesky', '#CandleMaking', 'niche', 75, '蜡烛手作人群'],
  ['bluesky', '#GiftWrapping', 'niche', 65, '礼盒场景'],
  ['bluesky', '#Unboxing', 'audience', 70, '消费者视角'],
  ['bluesky', '#SmallBusiness', 'audience', 65, '小品牌创始人'],
  ['bluesky', '#ProductPackaging', 'niche', 60, ''],
  ['bluesky', '#SustainablePackaging', 'niche', 55, '环保向'],
  ['bluesky', '#Procurement', 'audience', 45, '采购岗'],
  // Instagram：视觉型
  ['instagram', '#packagingdesign', 'broad', 80, ''],
  ['instagram', '#custompackaging', 'broad', 75, ''],
  ['instagram', '#jewelrypackaging', 'niche', 85, '精准'],
  ['instagram', '#candlepackaging', 'niche', 80, ''],
  ['instagram', '#giftbox', 'niche', 75, ''],
  ['instagram', '#rigidbox', 'niche', 70, ''],
  ['instagram', '#luxurypackaging', 'niche', 65, ''],
  ['instagram', '#unboxing', 'audience', 85, '流量大'],
  ['instagram', '#smallbusinessowner', 'audience', 70, ''],
  ['instagram', '#packaginginspiration', 'audience', 60, ''],
  ['instagram', '#brandpackaging', 'niche', 55, ''],
  // Pinterest：搜索型，标签当关键词用
  ['pinterest', 'custom jewelry box', 'broad', 85, ''],
  ['pinterest', 'jewelry packaging ideas', 'broad', 80, ''],
  ['pinterest', 'candle packaging', 'niche', 80, ''],
  ['pinterest', 'gift box packaging', 'niche', 75, ''],
  ['pinterest', 'luxury packaging design', 'niche', 70, ''],
  ['pinterest', 'packaging mockup', 'niche', 60, ''],
  ['pinterest', 'rigid box packaging', 'niche', 65, ''],
  ['pinterest', 'unboxing experience', 'audience', 70, ''],
  ['pinterest', 'small business packaging', 'audience', 75, ''],
  ['pinterest', 'eco friendly packaging', 'audience', 60, ''],
  // TikTok：话题标签
  ['tiktok', '#packaging', 'broad', 85, '大词'],
  ['tiktok', '#packagingdesign', 'broad', 75, ''],
  ['tiktok', '#smallbusiness', 'broad', 90, '流量极大'],
  ['tiktok', '#unboxing', 'broad', 90, ''],
  ['tiktok', '#jewelrybusiness', 'niche', 70, ''],
  ['tiktok', '#candlebusiness', 'niche', 65, ''],
  ['tiktok', '#custompackaging', 'niche', 70, ''],
  ['tiktok', '#packagingideas', 'niche', 55, ''],
  ['tiktok', '#smallbusinesstips', 'audience', 65, ''],
  ['tiktok', '#ecommercetips', 'audience', 60, ''],
];

const ins = db.prepare('insert or ignore into hashtag(platform, tag, tier, weight, note) values (?,?,?,?,?)');
let n = 0;
for (const row of seed) n += ins.run(...row).changes;
console.log('新增标签:', n, '总数:', db.prepare('select count(*) c from hashtag').get().c);
const byPlat = db.prepare('select platform, tier, count(*) c from hashtag group by 1,2 order by 1,2').all();
console.log(JSON.stringify(byPlat));
