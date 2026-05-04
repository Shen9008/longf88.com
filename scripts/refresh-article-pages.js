'use strict';

/**
 * Re-renders all article HTML files from the current article.template.html,
 * preserving body HTML between <!-- article-sync-* --> markers and optional TOC nav.
 * Reads slugs from assets/data/blogs.json. Requires existing pages on disk.
 */
const fs = require('fs');
const path = require('path');
const { renderArticle } = require('./lib/render-article.js');
const { formatDateLong, formatDateISO } = require('./lib/normalize-post.js');
const { getBlogSegment } = require('./lib/site-origin.js');

const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env.local') });

const BLOGS_PATH = path.join(ROOT, 'assets/data/blogs.json');

function blogsEntryToNormalized(entry, content) {
  const pd = entry.published_date || '';
  return {
    slug: entry.slug,
    title: entry.title,
    meta_title: entry.meta_title || entry.title,
    meta_description: entry.meta_description || entry.excerpt || '',
    excerpt: entry.excerpt || '',
    category: entry.category || 'Informational',
    published_date: pd,
    published_date_formatted: formatDateLong(pd) || pd,
    updated_date_iso: formatDateISO(pd) || pd,
    reading_time: entry.reading_time || '5 min read',
    focus_keyword: entry.focus_keyword || entry.title,
    content,
    toc_json: [],
    related_posts: entry.related_posts || [],
    faq: entry.faq,
  };
}

function extractToc(html) {
  const tocBlock = html.match(/<nav class="toc-block"[^>]*>[\s\S]*?<\/nav>/);
  if (tocBlock) return tocBlock[0].trim();
  const legacy = html.match(/<nav class="quick-facts"[^>]*>[\s\S]*?<\/nav>/);
  if (legacy) return legacy[0].trim();
  return '';
}

/** Upgrade legacy quick-facts TOC to toc-block (drop inline styles). */
function normalizeTocHtml(fragment) {
  if (!fragment || fragment.includes('toc-block')) return fragment;
  if (!fragment.includes('quick-facts')) return fragment;
  let s = fragment.replace(
    /<nav class="quick-facts"[^>]*>/,
    '<nav class="toc-block" aria-label="Table of contents">',
  );
  s = s.replace(/<h2[^>]*>Table of Contents<\/h2>/i, '<h2 class="toc-block__title">Table of Contents</h2>');
  s = s.replace(/<ol[^>]*>/, '<ol class="toc-block__list">');
  return s;
}

function extractBody(html) {
  const m = html.match(/<!-- article-sync-start -->\s*([\s\S]*?)\s*<!-- article-sync-end -->/);
  return m ? m[1].trim() : '';
}

function run() {
  const blogs = JSON.parse(fs.readFileSync(BLOGS_PATH, 'utf8'));
  if (!Array.isArray(blogs)) throw new Error('blogs.json must be an array');

  const seg = getBlogSegment();
  let n = 0;

  for (const entry of blogs) {
    if (!entry.slug) continue;
    const htmlPath = path.join(ROOT, seg, entry.slug, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      console.warn('Skip (no file):', entry.slug);
      continue;
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const content = extractBody(html);
    if (!content) {
      console.warn('Skip (no body markers):', entry.slug);
      continue;
    }
    const tocHtml = normalizeTocHtml(extractToc(html));
    const normalized = blogsEntryToNormalized(entry, content);
    const opts = { blogs };
    if (tocHtml) opts.tocHtml = tocHtml;
    renderArticle(normalized, opts);
    n += 1;
    console.log('Refreshed:', entry.slug);
  }
  console.log('Done.', n, 'page(s).');
}

run();
