'use strict';

const fs = require('fs');
const path = require('path');

require('./lib/load-env.js');

const { ROOT } = require('./lib/load-env.js');

const { fetchPosts } = require('./lib/fetch-posts.js');
const { normalizePost, validatePost } = require('./lib/normalize-post.js');
const { renderArticle } = require('./lib/render-article.js');
const { generateSitemap } = require('./lib/generate-sitemap.js');
const { hashContent, getCmsUpdatedAt, postChanged } = require('./lib/content-hash.js');
const { getBlogSegment, getSiteOrigin, getSyncSiteHostname } = require('./lib/site-origin.js');

const BLOGS_JSON_PATH = path.join(ROOT, 'assets/data/blogs.json');

const BLOGS_JSON_FIELDS = [
  'slug', 'title', 'meta_title', 'meta_description', 'focus_keyword',
  'category', 'search_intent', 'published_date', 'reading_time',
  'excerpt', 'featured_image', 'placeholder_gradient', 'related_posts', 'keywords',
  'updated_date_iso', 'updated_at', 'synced_at', 'cms_updated_at', 'content_hash',
];

function parseArgs(argv) {
  const args = {
    all: false,
    daily: false,
    refresh: false,
    force: false,
    limit: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--daily') args.daily = true;
    else if (arg === '--refresh') args.refresh = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--limit') {
      const n = parseInt(argv[++i], 10);
      if (!Number.isNaN(n) && n > 0) args.limit = n;
    }
  }
  return args;
}

function toBlogsEntry(normalized, raw) {
  const entry = {};
  for (const k of BLOGS_JSON_FIELDS) {
    if (normalized[k] !== undefined) entry[k] = normalized[k];
  }
  entry.content_hash = hashContent(raw.content);
  entry.cms_updated_at = getCmsUpdatedAt(raw);
  return entry;
}

function comparePostsByRecency(a, b) {
  const aHasSync = Boolean(a.synced_at);
  const bHasSync = Boolean(b.synced_at);
  if (aHasSync && !bHasSync) return -1;
  if (!aHasSync && bHasSync) return 1;

  if (aHasSync && bHasSync) {
    const sync =
      new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime();
    if (sync !== 0) return sync;
  }

  const pub =
    new Date(b.published_date || 0).getTime() - new Date(a.published_date || 0).getTime();
  if (pub !== 0) return pub;

  const cms =
    new Date(b.cms_updated_at || 0).getTime() - new Date(a.cms_updated_at || 0).getTime();
  if (cms !== 0) return cms;

  return String(b.slug || '').localeCompare(String(a.slug || ''));
}

function sortBlogsForDisplay(blogs) {
  return [...blogs].sort(comparePostsByRecency);
}

function getRelatedSlugs(blogs, currentSlug, opts = {}, limit = 3) {
  const searchIntent = (opts.searchIntent || 'informational').toLowerCase();
  const category = (opts.category || '').toLowerCase();
  const others = blogs.filter((b) => b.slug !== currentSlug);
  const byDate = comparePostsByRecency;

  const sameIntent = others.filter((b) => (b.search_intent || '').toLowerCase() === searchIntent).sort(byDate);
  const sameIntentSlugs = new Set(sameIntent.map((b) => b.slug));
  const sameCategory = others
    .filter((b) => !sameIntentSlugs.has(b.slug) && category && (b.category || '').toLowerCase() === category)
    .sort(byDate);
  const sameCategorySlugs = new Set(sameCategory.map((b) => b.slug));
  const rest = others
    .filter((b) => !sameIntentSlugs.has(b.slug) && !sameCategorySlugs.has(b.slug))
    .sort(byDate);

  const merged = [...sameIntent, ...sameCategory, ...rest];
  return merged.slice(0, limit).map((b) => b.slug);
}

function loadBlogsJson() {
  try {
    const raw = fs.readFileSync(BLOGS_JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveBlogsJson(blogs) {
  fs.mkdirSync(path.dirname(BLOGS_JSON_PATH), { recursive: true });
  const json = JSON.stringify(blogs, null, 2);
  fs.writeFileSync(BLOGS_JSON_PATH, json + '\n', 'utf8');
}

function getPostSlug(raw) {
  return raw.slug || raw.documentId || '';
}

function buildWorklist(strapiPosts, existingBlogs, mode) {
  const blogsBySlug = new Map(existingBlogs.map((b) => [b.slug, b]));
  const apiBySlug = new Map();
  for (const p of strapiPosts) {
    const slug = getPostSlug(p);
    if (slug) apiBySlug.set(slug, p);
  }

  const newPosts = strapiPosts
    .filter((p) => {
      const slug = getPostSlug(p);
      return slug && !blogsBySlug.has(slug);
    })
    .sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));

  let toCreate = [];
  if (mode.daily || (!mode.all && !mode.refresh && !mode.force)) {
    toCreate = newPosts.slice(0, 1);
  } else {
    toCreate = [...newPosts];
  }

  if (mode.all && mode.limit != null) {
    toCreate = toCreate.slice(0, mode.limit);
  }

  const createSlugs = new Set(toCreate.map(getPostSlug));

  let toUpdate = [];
  if (mode.force) {
    toUpdate = existingBlogs
      .map((e) => apiBySlug.get(e.slug))
      .filter(Boolean);
  } else if (mode.refresh || mode.daily) {
    toUpdate = existingBlogs
      .filter((e) => {
        const raw = apiBySlug.get(e.slug);
        return raw && !createSlugs.has(e.slug) && postChanged(e, raw);
      })
      .map((e) => apiBySlug.get(e.slug));
  }

  let worklist = [
    ...toCreate.map((raw) => ({ raw, isUpdate: false })),
    ...toUpdate.map((raw) => ({ raw, isUpdate: true })),
  ];

  if (!mode.all && mode.limit != null) {
    worklist = worklist.slice(0, mode.limit);
  }

  return { worklist, newCount: toCreate.length, updateCount: toUpdate.length };
}

function siteFilterSkipped() {
  return /^(1|true|yes)$/i.test(process.env.STRAPI_SKIP_SITE_FILTER || '')
    || /^(1|true|yes)$/i.test(process.env.SKIP_POSTS_SITE_FILTER || '');
}

function processPost(raw, blogs, isUpdate) {
  const slug = getPostSlug(raw);
  const related = getRelatedSlugs(blogs, slug, {
    searchIntent: raw.search_intent,
    category: raw.category,
  });

  const normalized = normalizePost(raw, { relatedPosts: related });
  validatePost(normalized);

  console.log(`  - ${isUpdate ? 'refresh' : 'publish'}: ${normalized.title} (${slug})`);
  renderArticle(normalized, { blogs });

  const entry = toBlogsEntry(normalized, raw);
  entry.synced_at = new Date().toISOString();

  if (isUpdate) {
    const idx = blogs.findIndex((b) => b.slug === slug);
    if (idx >= 0) blogs[idx] = entry;
    else blogs.push(entry);
  } else {
    blogs.push(entry);
  }
}

async function run() {
  const mode = parseArgs(process.argv);
  const apiUrl = process.env.STRAPI_API_URL || 'http://localhost:1337/api';

  const modeLabel = mode.daily
    ? 'daily (1 new + refresh changed)'
    : mode.force
      ? 'force (re-render all synced)'
      : mode.refresh
        ? 'refresh (new + changed)'
        : mode.all
          ? 'all new'
          : 'default (1 new)';

  console.log(
    `Fetching posts from Strapi (${apiUrl}/${process.env.STRAPI_COLLECTION || process.env.BLOG_COLLECTION || 'mansion88-posts'})…`,
  );
  console.log(`Sync mode: ${modeLabel}`);
  console.log(
    `Publishing HTML under "${getBlogSegment()}/" · canonical ${getSiteOrigin()}`,
  );

  const syncHost = getSyncSiteHostname();
  if (syncHost && !siteFilterSkipped()) {
    const style = (process.env.STRAPI_SITE_FILTER_STYLE || 'relation').trim().toLowerCase();
    if (style === 'field') {
      const field = process.env.STRAPI_SITE_DOMAIN_FIELD || 'site_domain';
      console.log(`Sync site filter (field): ${field} must match host "${syncHost}" (from SITE_DOMAIN).`);
    } else {
      const rel = process.env.STRAPI_SITE_RELATION || 'site';
      const dom = process.env.STRAPI_SITE_RELATION_DOMAIN_FIELD || 'domain';
      console.log(
        `Sync site filter (API): filters[${rel}][${dom}][$eq]=${syncHost} (from SITE_DOMAIN).`,
      );
    }
  }

  const strapiPosts = await fetchPosts({ baseUrl: apiUrl });
  const existingBlogs = loadBlogsJson();
  const { worklist, newCount, updateCount } = buildWorklist(strapiPosts, existingBlogs, mode);

  if (worklist.length === 0) {
    if (
      syncHost &&
      strapiPosts.length === 0 &&
      !siteFilterSkipped()
    ) {
      console.log(
        'Nothing to sync (no Strapi rows matched SITE_DOMAIN after filtering).',
      );
      console.log(
        'For relation filters: confirm filters[site][domain][$eq] in Strapi matches SITE_DOMAIN. For flat fields: set STRAPI_SITE_FILTER_STYLE=field and STRAPI_SITE_DOMAIN_FIELD. Or STRAPI_SKIP_SITE_FILTER=1 to sync all rows.',
      );
    } else {
      console.log('Nothing to sync (no new posts and no changed posts).');
    }
    return;
  }

  console.log(
    `Processing ${worklist.length} article(s) (${newCount} new, ${updateCount} refresh)…`,
  );

  let blogs = [...existingBlogs];

  for (const { raw, isUpdate } of worklist) {
    processPost(raw, blogs, isUpdate);
  }

  saveBlogsJson(sortBlogsForDisplay(blogs));
  generateSitemap();
  console.log('Done. blogs.json and sitemap.xml updated.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
