// Usage counter for Karbka: an AWS Lambda behind a Function URL, writing to its own DynamoDB table.
// Setup, the table layout and how to read the numbers: README.md next to this file.
//
// The app (app.karbka.com) sends one request a day per device, the landing page (karbka.com) one per
// page view and one per click on "Open Karbka". Each request adds 1 to a single row: the total for one
// UTC day and one combination of the coarse values below. Nothing else is kept: no IP address, no ID,
// no cookie, no user agent, no time of day. Rows delete themselves after KEEP_DAYS (DynamoDB TTL).
// Every value is checked against a fixed list, so the table can only ever hold these values.

export const ORIGINS = ['https://karbka.com', 'https://app.karbka.com'];
export const PLATFORMS = ['ios', 'android', 'mac', 'windows', 'linux', 'other'];
export const FORMS = ['phone', 'tablet', 'desktop'];
// The app's interface languages (src/lib/i18n/index.svelte.ts).
export const LANGS = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'pt', 'it', 'tr', 'nl', 'zh'];
// Days since the device first opened the app.
export const AGES = ['0', '1-7', '8-30', '31-90', '91+'];
// Cards in the library.
export const CARDS = ['0', '1-50', '51-500', '501-2000', '2001+'];
// When a test was last finished on the device.
export const STUDIED = ['week', 'month', 'older', 'never'];
// Landing pages: / and /ua/.
export const PAGES = ['en', 'ua'];
export const KEEP_DAYS = 730;
const MAX_BODY = 1000;

const oneOf = (list, value) => (list.includes(value) ? value : null);

/** The site a visitor came from, as a bare host name: "direct", "google.com", or "other" if it doesn't look like one. */
export function referrer(value) {
  if (value === '' || value === undefined) return 'direct';
  if (typeof value !== 'string' || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value) || value.length > 64) return 'other';
  const host = value.replace(/^www\./, '');
  return host === 'karbka.com' || host.endsWith('.karbka.com') ? 'karbka.com' : host;
}

/**
 * The row a request counts in, or null if anything in it is unexpected.
 * pk is "app#<day>" or "site#<day>"; sk joins the values in a fixed order; fields keeps them by name for reading.
 */
export function toCount(body, now = new Date()) {
  if (!body || typeof body !== 'object') return null;
  const day = now.toISOString().slice(0, 10);
  const platform = oneOf(PLATFORMS, body.platform);
  const form = oneOf(FORMS, body.form);
  if (!platform || !form) return null;

  let pk;
  let fields;
  if (body.kind === 'app') {
    fields = {
      kind: 'app',
      platform,
      form,
      installed: body.installed === true ? 'installed' : body.installed === false ? 'tab' : null,
      version: typeof body.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(body.version) ? body.version : null,
      lang: oneOf(LANGS, body.lang),
      age: oneOf(AGES, body.age),
      cards: oneOf(CARDS, body.cards),
      studied: oneOf(STUDIED, body.studied),
    };
    pk = `app#${day}`;
  } else if (body.kind === 'view') {
    fields = { kind: 'view', page: oneOf(PAGES, body.page), platform, form, ref: referrer(body.ref) };
    pk = `site#${day}`;
  } else if (body.kind === 'open') {
    fields = { kind: 'open', page: oneOf(PAGES, body.page), platform, form };
    pk = `site#${day}`;
  } else {
    return null;
  }
  if (Object.values(fields).includes(null)) return null;
  return { pk, sk: Object.values(fields).join('|'), fields };
}

const response = (statusCode) => ({ statusCode, headers: { 'cache-control': 'no-store' } });

let client;
async function add(count, now) {
  // Loaded here, not at the top, so the tests can import this file without the AWS SDK (the Lambda runtime has it).
  const { DynamoDBClient, UpdateItemCommand } = await import('@aws-sdk/client-dynamodb');
  client ??= new DynamoDBClient({});
  const expires = Math.floor(now.getTime() / 1000) + KEEP_DAYS * 86400;
  await client.send(new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: { pk: { S: count.pk }, sk: { S: count.sk } },
    UpdateExpression: 'ADD #count :one SET #expires = :expires, #fields = :fields',
    ExpressionAttributeNames: { '#count': 'count', '#expires': 'expires', '#fields': 'fields' },
    ExpressionAttributeValues: {
      ':one': { N: '1' },
      ':expires': { N: String(expires) },
      ':fields': { M: Object.fromEntries(Object.entries(count.fields).map(([k, v]) => [k, { S: v }])) },
    },
  }));
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method !== 'POST') return response(405);
  // Only the two Karbka sites. Anyone can fake this header; it keeps out stray requests, not a determined one.
  if (!ORIGINS.includes(event.headers?.origin)) return response(403);
  const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event.body ?? '');
  if (raw.length > MAX_BODY) return response(413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return response(400);
  }
  const now = new Date();
  const count = toCount(body, now);
  if (!count) return response(400);
  await add(count, now);
  // Nothing is logged: the request, its IP and its headers never reach CloudWatch.
  return response(204);
};
