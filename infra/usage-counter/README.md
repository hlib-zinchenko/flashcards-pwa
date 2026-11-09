# Usage counter

How many people use Karbka, on which devices, and whether they come back. It answers one question: is it worth developing Karbka further, and making native iPhone and Android apps?

`index.mjs` is an AWS Lambda behind a Function URL that adds 1 to a row in its own DynamoDB table. It's separate from the hzinchenko.com counter: its own function, table and role. `report.mjs` prints the numbers.

## What is counted

Every request adds 1 to the row for one UTC day and one combination of these values. Nothing else is stored: no IP address, no ID, no cookie, no user agent, no time of day. A row says "on 2026-11-09, 3 devices sent exactly these values", never who.

**The app** (`src/lib/usage.ts`), once a day per device, on the first launch that day, only on app.karbka.com:

| Field | Values |
| --- | --- |
| `platform` | ios, android, mac, windows, linux, other |
| `form` | phone, tablet, desktop |
| `installed` | installed (home screen, Dock, installed app) or tab |
| `version` | the app version, like 1.0.0 |
| `lang` | the interface language |
| `age` | days since the device first opened the app: 0, 1-7, 8-30, 31-90, 91+ |
| `cards` | cards in the library: 0, 1-50, 51-500, 501-2000, 2001+ |
| `studied` | last finished test: week, month, older, never |

**The landing page** (`site.js` in karbka-site), on karbka.com:

- `view` on each page load: `page` (en or ua), `platform`, `form`, `ref` (the host name of the site the visitor came from, or direct).
- `open` on each click on a link to the app: `page`, `platform`, `form`.

Neither sends anything when the browser has Global Privacy Control turned on, and the app sends nothing after the person turns it off in Settings → Usage counts.

Rows expire after 2 years (`KEEP_DAYS`).

## Table: `karbka-usage`

DynamoDB → Create table, region **eu-north-1** (Stockholm), like the hzinchenko.com counter.

- Partition key `pk` (String), sort key `sk` (String).
- Table settings: Customize → **On-demand** capacity. Leave encryption as the AWS-owned key.
- After it's created: Additional settings → Time to Live → Turn on, attribute **`expires`**.

Rows look like this:

| pk | sk | count | fields | expires |
| --- | --- | --- | --- | --- |
| `app#2026-11-09` | `app\|ios\|phone\|installed\|1.0.0\|uk\|8-30\|51-500\|week` | 3 | the same values by name | 2 years later, epoch seconds |
| `site#2026-11-09` | `view\|ua\|android\|phone\|google.com` | 12 | … | … |
| `site#2026-11-09` | `open\|en\|ios\|phone` | 4 | … | … |

## Function: `karbka-usage-counter`

Lambda → Create function → Author from scratch, region **eu-north-1**.

- Runtime **Node.js 22.x**, architecture **arm64**.
- Execution role: create a new role with basic Lambda permissions. Then add this inline policy to it (IAM → Roles → the role → Add permissions → Create inline policy → JSON), with your account id:

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "dynamodb:UpdateItem",
        "Resource": "arn:aws:dynamodb:eu-north-1:ACCOUNT_ID:table/karbka-usage"
      }
    ]
  }
  ```

- Code: replace `index.mjs` in the editor with this folder's `index.mjs`, then Deploy. The handler stays `index.handler`.
- Configuration → General: memory **128 MB**, timeout **5 s**.
- Configuration → Environment variables: `TABLE_NAME` = `karbka-usage`.
- Configuration → Concurrency: reserve **5**. A flood of fake requests then can't run up the bill; real traffic is far below that.
- Configuration → Function URL → Create: auth type **NONE**. Leave CORS off: the pages send `no-cors` requests and never read the answer, and the function checks the `Origin` header itself.
- CloudWatch → Log groups → `/aws/lambda/karbka-usage-counter` → retention **1 week**. The function logs nothing of its own, only Lambda's start and end lines.

Then put the Function URL in the app (`USAGE_URL` in `src/lib/usage.ts`, plus `connect-src` in `index.html`) and in the site (`USAGE_URL` in `site.js`). Until then both send nothing.

### Check it

```bash
curl -i -X POST "$URL" -H 'origin: https://karbka.com' -H 'content-type: text/plain' \
  --data '{"kind":"view","page":"en","platform":"mac","form":"desktop","ref":""}'
```

`204` means a row in the table went up by 1. A wrong origin gives `403`, an unknown value `400`.

## Reading the numbers

```bash
cd infra/usage-counter
npm install
AWS_REGION=eu-north-1 TABLE_NAME=karbka-usage node report.mjs 28
```

It needs AWS credentials that can `dynamodb:Query` the table (your own, not the function's role). It prints devices a day, the platform split, how many are installed, how long people have had the app, and for each platform how many new devices installed it compared with how many visited the site.

What to look for:

- **Are people coming back?** Devices in the 8-30 and 31-90 day groups that studied this week. If almost everyone is in 0 and 1-7, a native app won't fix that.
- **Where are they?** The share of iOS against Android and desktop.
- **Does installing work?** iOS site views against new iOS devices that are installed. Many visitors and few installs means Add to Home Screen is where people give up, and the App Store would help.
