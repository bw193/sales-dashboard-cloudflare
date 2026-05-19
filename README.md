# Sales Dashboard

Cloudflare-backed sales dashboard that reads and writes sales records through
Cloudflare Pages Functions and D1.

## Data Source

The dashboard intentionally does not include local sales spreadsheets, generated
JSON, or generated JavaScript data. Runtime data comes from:

```text
/api/sales
```

That endpoint is implemented with Cloudflare Pages Functions and the D1 binding
named `DB`.

## Cloudflare Setup

Create this as a **Cloudflare Pages** project, not a Workers project.

Recommended Pages build settings:

```text
Framework preset: None
Build command: npm run build
Build output directory: .
Root directory: /
```

Do not use `npx wrangler deploy` in the Cloudflare build settings. That command
deploys a Worker and will fail for this Pages repository. If you deploy manually
from your machine, use:

```bash
npm run deploy:pages
```

Then configure the backend:

1. Create or connect a Cloudflare D1 database.
2. Bind it to the Pages project as `DB`.
3. Apply the schema:

```bash
npm run db:schema
```

4. Set `SALES_ADMIN_TOKEN` as a Pages secret for add/edit/delete actions.

Read-only dashboard views do not need a browser token. Write actions prompt for
the admin token and send it as a bearer token.

## Local Preview

Cloudflare Pages local D1 preview may require a working Workers runtime. If
Wrangler runs normally:

```bash
npm run dev
```

For production, deploy the project to Cloudflare Pages with the `DB` binding and
`SALES_ADMIN_TOKEN` configured.
