// Prints what the usage counter has counted over the last N days (default 28), as the numbers that
// answer "is Karbka used, and would native apps help?". Reads the table with your own AWS credentials:
//   cd infra/usage-counter && npm install && AWS_REGION=eu-north-1 TABLE_NAME=karbka-usage node report.mjs 28
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const days = Number(process.argv[2] ?? 28);
const table = process.env.TABLE_NAME ?? 'karbka-usage';
const db = new DynamoDBClient({});

async function rows(pk) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': { S: pk } },
      ExclusiveStartKey,
    }));
    for (const item of page.Items ?? []) {
      out.push({ count: Number(item.count.N), ...Object.fromEntries(Object.entries(item.fields.M).map(([k, v]) => [k, v.S])) });
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

const dayList = Array.from({ length: days }, (_, i) => new Date(Date.now() - (i + 1) * 86400000).toISOString().slice(0, 10));
const app = (await Promise.all(dayList.map((d) => rows(`app#${d}`)))).flat();
const site = (await Promise.all(dayList.map((d) => rows(`site#${d}`)))).flat();

const sum = (list) => list.reduce((n, r) => n + r.count, 0);
const by = (list, key) => {
  const totals = {};
  for (const r of list) totals[r[key]] = (totals[r[key]] ?? 0) + r.count;
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
};
const pct = (part, whole) => (whole ? `${Math.round((100 * part) / whole)}%` : '–');
const table_ = (title, entries, whole) => {
  console.log(`  ${title}`);
  for (const [k, n] of entries) console.log(`    ${k.padEnd(16)} ${String(n).padStart(6)}  ${pct(n, whole)}`);
};

console.log(`\nKarbka usage, the ${days} full UTC days before today (${dayList.at(-1)} to ${dayList[0]})\n`);

const opens = sum(app);
console.log(`App: ${opens} device-days, ${(opens / days).toFixed(1)} devices a day on average`);
if (opens) {
  table_('platform', by(app, 'platform'), opens);
  table_('device', by(app, 'form'), opens);
  table_('installed or in a browser tab', by(app, 'installed'), opens);
  table_('days since first open (are people coming back?)', by(app, 'age'), opens);
  table_('studied', by(app, 'studied'), opens);
  table_('cards in the library', by(app, 'cards'), opens);
  table_('language', by(app, 'lang'), opens);
  table_('version', by(app, 'version'), opens);
}

const views = site.filter((r) => r.kind === 'view');
const clicks = site.filter((r) => r.kind === 'open');
console.log(`\nSite: ${sum(views)} page views, ${sum(clicks)} clicks on Open Karbka (${pct(sum(clicks), sum(views))} of views)`);
if (views.length) {
  table_('platform', by(views, 'platform'), sum(views));
  table_('page', by(views, 'page'), sum(views));
  table_('came from', by(views, 'ref').slice(0, 15), sum(views));
}

// New devices: first day in the app. On iPhone and iPad, installed ones are the people who got through Add to Home Screen.
const firstDay = app.filter((r) => r.age === '0');
console.log('\nNew devices in the app, and how many of them were installed, by platform');
for (const [platform, n] of by(firstDay, 'platform')) {
  const installed = sum(firstDay.filter((r) => r.platform === platform && r.installed === 'installed'));
  const platformViews = sum(views.filter((r) => r.platform === platform));
  console.log(`    ${platform.padEnd(16)} ${String(n).padStart(6)} new, ${installed} installed (${pct(installed, n)}), ${platformViews} site views`);
}
console.log('');
