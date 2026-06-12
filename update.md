# Blog fetching & sync — update notes

Summary of changes to the Strapi → static blog pipeline (`scripts/content-sync.js` and related tooling).

---

## What changed (overview)

Previously, sync was **append-only**: only posts whose slug was **not** in `assets/data/blogs.json` were fetched and rendered. Existing posts were never updated, so API changes (including cross-site links injected into `content`) did not appear on the site.

The pipeline now supports **create + update (upsert)**, a **daily workflow**, and an **API site filter** so sync only fetches posts assigned to this site in Strapi.

---

## Sync commands

| Command | Behavior |
|---------|----------|
| `npm run sync` | Publish **1 new** post (slug not yet in `blogs.json`) |
| `npm run sync:all` | Publish **all new** posts in one run |
| `npm run sync:refresh` | Add new posts + re-render existing posts **only when changed** (`content_hash` or `updatedAt`) |
| `npm run sync:force` | Re-fetch and re-render **every** post returned by the API |
| `npm run sync:daily` | **Recommended for CI** — 1 new post + **refresh changed** synced posts (`content_hash` / `updatedAt`) |
| `npm run sync:doctor` | Print env config and sample API URL (no network required for config) |
| `npm run backfill` | Inject same-site `/blog/` links into **unchanged** articles (skips files with nothing to add) |
| `npm run backfill:force` | Strip existing `/blog/` links, then re-inject across all articles (one-off) |
| `npm run audit:links` | Audit same-site internal links in rendered HTML |

### Flags

```bash
node scripts/content-sync.js --daily
node scripts/content-sync.js --all --limit 10   # e.g. reset: fetch 10 new posts only
```

| Flag | Purpose |
|------|---------|
| `--daily` | 1 new + refresh **changed** synced slugs |
| `--refresh` | Update only changed existing posts |
| `--force` | Re-render all API posts |
| `--all` | Process all **new** posts (not all existing) |
| `--limit N` | Cap how many posts to process in one run |

---

## Daily sync (`sync:daily`) — recommended workflow

Each run:

1. **Create** — at most **1** post from the API whose slug is not yet in `blogs.json` (oldest by `publishedAt`)
2. **Refresh** — re-render synced posts **only when changed** (`content_hash` or API `updatedAt` differs from last sync)

This is equivalent to running **1 new post**, then **`sync:refresh` logic** on existing entries — without publishing all remaining new posts at once.

This supports:

- **Cross-site links** when the API updates `content`
- **Same-site internal links** via local `injectInternalLinks` on re-rendered posts
- Faster daily runs than re-rendering every synced post

GitHub Actions (`.github/workflows/daily-sync.yml`) runs `sync:daily`, then `npm run backfill`, on schedule (`0 2 * * *` UTC) and on manual dispatch.

---

## API content vs local internal links

Two layers work together:

| Link type | Source |
|-----------|--------|
| Cross-site (`https://other-domain.com/...`) | API `content` field |
| Same-site (`/blog/{slug}.html`) | Local `injectInternalLinks` in `scripts/lib/render-article.js` |

The API does **not** add same-site blog links. Local injection skips text already inside `<a>` tags, so API cross-site links are not overwritten.

**Daily CI order:** `sync:daily` → `backfill` → commit → deploy.

- **`sync:daily`** — 1 new post + re-render changed posts (cross-site links from API on those renders)
- **`npm run backfill`** — adds same-site `/blog/` links to **unchanged** articles that were not re-rendered (writes only when new links can be added)

`backfill:force` strips existing `/blog/` links first, then re-injects — use for one-off full refresh; daily CI uses `backfill` only.

---

## New fields in `blogs.json`

| Field | Purpose |
|-------|---------|
| `cms_updated_at` | Strapi `updatedAt` — used to detect CMS changes; tiebreaker when `synced_at` matches |
| `content_hash` | SHA-256 fingerprint of API `content` — detects body changes (e.g. new cross-site links) |
| `synced_at` | When the static site last wrote this entry — **primary sort** for the public blog/news index |

### Blog index sort order

Guides on the **News hub** (`/news/`), **sidebar “latest”** on blog articles, and the order of rows in **`assets/data/blogs.json`** after each sync use the same rules (`js/blog-loader.js`, `scripts/content-sync.js`):

1. **`synced_at` newest first** (latest sync → older) — only this field drives primary order; newly published or refreshed posts surface at the top
2. **`published_date`** (newest first) — tiebreaker when two posts share the same `synced_at` (e.g. bulk-imported news guides)
3. **`cms_updated_at`** (newest first)
4. **`slug`** (alphabetical, descending)

Posts **without** `synced_at` sort to the **end** of the list (not by `published_date` as a stand-in for sync time). Run `npm run sync` / daily sync to set `synced_at` on Strapi-backed posts.

**News hub UI:** `/news/` loads `blog-loader.js` (non-deferred, before `news-hub.js`), sorts `blogs.json` client-side, fills **Featured picks** with the top 3 by `synced_at`, and lists **All guides** in the same order. Fetch uses `?v=sync-sort-2` to avoid stale CDN/browser cache.

---

## Site filter

Posts are fetched with:

```
GET {STRAPI_API_URL}/posts?filters[site][domain][$eq]={SITE_DOMAIN}&sort=publishedAt:asc&...
```

Required env (local `.env` / GitHub variables):

- `SITE_DOMAIN` — e.g. `example.com`
- `STRAPI_API_URL`, `STRAPI_API_TOKEN`

### Strict filter in CI

When `SYNC_REQUIRE_SITE_FILTER=1` (set in GitHub Actions):

- Sync **fails** if `SITE_DOMAIN` is empty, `SKIP_POSTS_SITE_FILTER` is enabled, or the filter key is missing
- Empty `POSTS_SITE_FILTER_KEY` env var falls back to `filters[site][domain][$eq]` (fixes CI passing blank optional vars)

---

## GitHub Actions workflow

File: `.github/workflows/daily-sync.yml`

Daily flow:

1. Validate Strapi secrets and `SITE_DOMAIN`
2. `npm run sync:doctor` (with `SYNC_REQUIRE_SITE_FILTER=1`)
3. `npm run sync:daily`
4. `npm run backfill`
5. Commit & push `assets/data/blogs.json`, `blog/`, `sitemap.xml` if changed
6. Deploy to Cloudflare Pages

### Required repository variables

| Variable | Example |
|----------|---------|
| `SITE_DOMAIN` | `example.com` |
| `SITE_BASE_URL` | `https://example.com` |
| `STRAPI_COLLECTION` | `posts` |
| `BLOG_BASE_PATH` | `blog` |

### Required secrets

| Secret | Purpose |
|--------|---------|
| `STRAPI_API_URL` | API base including `/api` |
| `STRAPI_API_TOKEN` | Bearer token |
| `CLOUDFLARE_API_TOKEN` | Pages deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Pages deploy |

---

## Common tasks

### First-time / bulk fetch (e.g. 10 posts)

```bash
# Clear blogs.json to []
# Delete blog/*.html except blog/index.html
node scripts/content-sync.js --all --limit 10
```

### Re-pull all synced posts after API content changes

```bash
npm run sync:force
```

### Routine local check

```bash
npm run sync:doctor
npm run sync:daily
npm run backfill
```

### Audit same-site links in rendered HTML

```bash
npm run audit:links
```

---

## Scaling notes

**For now:** use `npm run sync:daily` (1 new post + refresh changed synced posts). This is the default in CI and is sufficient while the blog catalog is small.

**Later (500+ posts or if CI gets slow):** revisit the strategy — e.g. rolling batch refresh, fetch-by-slug optimization, or raising the blog index cap (currently 594 posts in `js/blog-loader.js`). No changes needed until then.

To force a full re-pull of every synced post after a major API change, run `npm run sync:force` once manually.

---

## Incident: wrong-site post (example)

**Symptom:** A post for another brand appeared on `/blog/` (e.g. a post titled for `otherbrand.com`).

**Cause:** Strapi returned off-site posts under the `example.com` site filter. With append-only sync, the oldest “new” slug could be from another brand. A CI run added such a post.

**Fix applied:**

- `SYNC_REQUIRE_SITE_FILTER` in CI
- Empty `POSTS_SITE_FILTER_KEY` treated as default filter key
- Removed bad entry from `blogs.json` and deleted its HTML file

**Prevention:** Keep `SITE_DOMAIN` set in GitHub variables; do not enable `SKIP_POSTS_SITE_FILTER` in CI. Fix mis-assigned posts in Strapi so the site filter returns only this brand’s content.

---

## Files touched

| File | Role |
|------|------|
| `scripts/content-sync.js` | Sync modes, daily worklist, upsert |
| `scripts/lib/fetch-posts.js` | Paginated API fetch, site filter, strict filter assert |
| `scripts/lib/render-article.js` | Renders HTML; runs internal link injection |
| `scripts/lib/inject-internal-links.js` | Same-site `/blog/` link injection |
| `scripts/backfill-internal-links.js` | Backfill internal links into existing HTML |
| `scripts/sync-doctor.js` | Env/config diagnostics for sync |
| `scripts/audit-internal-links.js` | Audit same-site links in rendered articles |
| `assets/data/blogs.json` | Post metadata index |
| `blog/*.html` | Rendered article pages |
| `sitemap.xml` | Regenerated after sync |
| `.github/workflows/daily-sync.yml` | Daily CI sync, backfill, commit, deploy |
| `package.json` | `sync:daily`, `sync:refresh`, `sync:force`, `backfill` scripts |

---

## Related docs

- `script-setup.md` — full setup guide for the sync pipeline
- `.env` / `.env.example` — local environment variables
