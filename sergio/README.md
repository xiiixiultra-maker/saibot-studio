# Sergio’s coins

Public app: https://saibot.studio/sergio/

Spanish is the default, with an English toggle. Photographs, a thumbnail, quantities, box locations, notes and results are saved in IndexedDB in the current browser. They are not synced to other devices. JSON backups contain photos and metadata; CSV exports contain metadata only. Keep backups private. Clearing website data removes the local collection.

## Recognition

`config.js` points to the existing Cloudflare-account Worker at https://saibot-sergio-coins.saibot-studio.workers.dev. Two compressed JPEG images go to Cloudflare Workers AI (`@cf/qwen/qwen3.8-27b`). The Worker never persists coin photographs or collection records. The user must review the suggested date, country, denomination and mint mark before asking for a value. The model cannot certify authenticity, errors or grade.

## Market references: live

Cloudflare AI Gateway credits are active on the account’s `default` gateway. The Worker uses Cloudflare Web Search with Exa to find source pages. Ceramic returned no results for a common test coin, so Exa replaced it. There are no credentials in this repository.

Live verification on October 3, 2026 (October 4 UTC): `/value` returned a $55–$57 USD reference for a 1921 Philadelphia Morgan Dollar in circulated condition, from NGC's F12 and VF20 guide columns updated October 3. The activation notice clears after the app checks the Worker’s health. This is a test of the lookup, not an appraisal of Sergio’s coins.

The backend fetches allowlisted coin guides and auction sources, excluding community forums and historical news articles. NGC's public Coin Explorer loads its guide from public JSON endpoints; the Worker reads those same named grade columns directly, verifies country, year, denomination, mint and series, and excludes prooflike and plus-grade tables. Raw circulated coins use F/VF columns, worn coins AG/G/VG, and light wear XF/AU. The source must have an update within 180 days. No photo is assigned a numeric grade. Certified coins require an exact supported label grade. An unreadable mint must be clarified before valuation.

Other sources require exact observed USD amounts and compatible condition. If a page cannot be read, a source-linked search excerpt may be used and is visibly labeled. Completed sales need a verified date within 180 days; dated guides older than that are excluded. Undated guide references are labeled undated. Search indexes and guides can lag the market. When evidence is insufficient, **no value is assigned**. The range is the min/max of matching amounts, not a guaranteed sale price. Collection totals include only records with a found value.

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
