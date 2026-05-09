'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env.local') });

if (!String(process.env.BLOG_BASE_PATH || '').trim()) {
  const newsHub = path.join(ROOT, 'news', 'index.html');
  if (fs.existsSync(newsHub)) {
    process.env.BLOG_BASE_PATH = 'news';
  }
}

const { fetchPosts } = require('./lib/fetch-posts.js');
const { normalizePost, validatePost } = require('./lib/normalize-post.js');
const { renderArticle } = require('./lib/render-article.js');
const { generateSitemap } = require('./lib/generate-sitemap.js');
const { getBlogSegment, getSiteOrigin, getSyncSiteHostname } = require('./lib/site-origin.js');

const BLOGS_JSON_PATH = path.join(ROOT, 'assets/data/blogs.json');

const BLOGS_JSON_FIELDS = [
  'slug', 'title', 'meta_title', 'meta_description', 'focus_keyword',
  'category', 'search_intent', 'published_date', 'reading_time',
  'excerpt', 'placeholder_gradient', 'related_posts', 'keywords',
  'updated_date_iso', 'updated_at', 'synced_at',
];

function toBlogsEntry(normalized) {
  const entry = {};
  for (const k of BLOGS_JSON_FIELDS) {
    if (normalized[k] !== undefined) entry[k] = normalized[k];
  }
  return entry;
}

function comparePostsByRecency(a, b) {
  const pub =
    new Date(b.published_date || 0).getTime() - new Date(a.published_date || 0).getTime();
  if (pub !== 0) return pub;
  const upd =
    new Date(b.updated_at || b.published_date || 0).getTime() -
    new Date(a.updated_at || a.published_date || 0).getTime();
  if (upd !== 0) return upd;
  const sync =
    new Date(b.synced_at || 0).getTime() - new Date(a.synced_at || 0).getTime();
  if (sync !== 0) return sync;
  return String(a.slug || '').localeCompare(String(b.slug || ''));
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

async function run() {
  const all = process.argv.includes('--all');
  const apiUrl = process.env.STRAPI_API_URL || 'http://localhost:1337/api';

  console.log(
    `Fetching posts from Strapi (${apiUrl}/${process.env.STRAPI_COLLECTION || process.env.BLOG_COLLECTION || 'mansion88-posts'})…`,
  );
  console.log(
    `Publishing HTML under "${getBlogSegment()}/" · canonical ${getSiteOrigin()}`,
  );
  const syncHost = getSyncSiteHostname();
  if (syncHost && !/^(1|true|yes)$/i.test(process.env.STRAPI_SKIP_SITE_FILTER || '')) {
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
  const knownSlugs = new Set(existingBlogs.map((b) => b.slug));

  const unprocessed = strapiPosts
    .filter((p) => {
      const slug = p.slug || p.documentId || '';
      return slug && !knownSlugs.has(slug);
    })
    .sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));

  if (unprocessed.length === 0) {
    if (
      syncHost &&
      strapiPosts.length === 0 &&
      !/^(1|true|yes)$/i.test(process.env.STRAPI_SKIP_SITE_FILTER || '')
    ) {
      console.log(
        'No new articles to publish (no Strapi rows matched SITE_DOMAIN after filtering).',
      );
      console.log(
        'For relation filters: confirm filters[site][domain][$eq] in Strapi matches SITE_DOMAIN. For flat fields: set STRAPI_SITE_FILTER_STYLE=field and STRAPI_SITE_DOMAIN_FIELD. Or STRAPI_SKIP_SITE_FILTER=1 to sync all rows.',
      );
    } else {
      console.log('No new articles to publish.');
    }
    return;
  }

  const toProcess = all ? unprocessed : unprocessed.slice(0, 1);
  console.log(`Publishing ${toProcess.length} article(s)...`);

  let blogs = [...existingBlogs];
  const allSlugs = blogs.map((b) => b.slug);

  for (const raw of toProcess) {
    const slug = raw.slug || raw.documentId || '';
    const related = getRelatedSlugs(blogs, slug, {
      searchIntent: raw.search_intent,
      category: raw.category,
    });

    const normalized = normalizePost(raw, {
      relatedPosts: related,
    });
    validatePost(normalized);

    console.log(`  - ${normalized.title} (${slug})`);
    renderArticle(normalized, { blogs });

    const entry = toBlogsEntry(normalized);
    entry.synced_at = new Date().toISOString();
    blogs.push(entry);
    allSlugs.push(slug);
  }

  saveBlogsJson(sortBlogsForDisplay(blogs));
  generateSitemap();
  console.log('Done. blogs.json and sitemap.xml updated.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
