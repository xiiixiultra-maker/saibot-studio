# Sergio’s coins

Public app: https://saibot.studio/sergio/

Spanish is the default, with an English toggle. Photographs, a thumbnail, quantities, box locations, notes and results are saved in IndexedDB in the current browser. They are not synced to other devices. JSON backups contain photos and metadata; CSV exports contain metadata only. Keep backups private. Clearing website data removes the local collection.

## Recognition

`config.js` points to the existing Cloudflare-account Worker at https://saibot-sergio-coins.saibot-studio.workers.dev. Two compressed JPEG images go to Cloudflare Workers AI (`@cf/qwen/qwen3.8-27b`). The Worker never persists coin photographs or collection records. The user must review the suggested date, country, denomination and mint mark before asking for a value. The model cannot certify authenticity, errors or grade.

## Market references: activation outstanding

The recognition service is live and tested. At initial publication on October 3, 2026, Cloudflare Web Search returned `402 web_search_payment_required`. Live market lookup is **not enabled or verified end to end** until AI Gateway Unified Billing credits, or an existing Ceramic.ai provider key, are configured on the account’s `default` gateway. There are no credentials in this repository. Do not paste provider credentials into chat or this static website.

Once search credits are configured, use the app to query a coin or test `/value`. Successful search updates the Worker’s readiness status, so the app’s activation notice clears on its next load. No code change is needed to enable search. Confirm a real referenced result before describing pricing as available.

The backend fetches allowlisted coin guides and auction sources. If a page cannot be read, it may use a source-linked search excerpt, visibly labeled as such. It requires an exact observed USD amount, matching year/mint and compatible condition. Completed sales must have a verified date within 180 days. Guide references with unknown publication dates are labeled undated. Historical guides and search indexes may lag the market. When evidence is insufficient, **no value is assigned**. The range is the min/max of observed matching amounts, not a guaranteed sale price. Collection totals include only records with a found value.

## Usage limits and privacy

The `DailyBudget` Durable Object enforces 200 lookup requests per UTC day globally and 120 per IP per day. Identification and price lookup each consume one request. The counters store only daily hashed IPs; photos are handled in memory, and application observability is off. CORS accepts only the Saibot Studio origins. CORS is not authentication; this is an unlisted public app protected by bounded daily usage, not a private family login. Search calls can consume Gateway credits; these limits bound requests, not an exact dollar budget.

## Maintenance

Worker source and configuration: `../services/sergio-api/`.

```text
node --test services/sergio-api/worker.test.mjs
wrangler deploy --config services/sergio-api/wrangler.jsonc
```

Commit and push static frontend changes to the existing `main` branch to publish through the existing GitHub Pages setup. Preserve the root `CNAME`, site and other projects.

Initial recognition checks: a blank pair was rejected; public 1879-S Morgan photos returned Morgan Dollar, 1879, medium confidence and an unreadable mint. This demonstrates basic functionality, not a measured accuracy guarantee across Sergio’s collection.
