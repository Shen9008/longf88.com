'use strict';

const fs = require('fs');
const path = require('path');
const { injectInternalLinks } = require('./lib/inject-internal-links.js');
const { getBlogSegment } = require('./lib/site-origin.js');

const ROOT = path.resolve(__dirname, '..');
const BLOGS_JSON_PATH = path.join(ROOT, 'assets/data/blogs.json');

/** New longf88 article template (markers required for reliable backfill). */
const ARTICLE_SYNC_RE = /<!-- article-sync-start -->\s*([\s\S]*?)\s*<!-- article-sync-end -->/;

const PROSE_REGEX = /<div class="article-prose">\s*([\s\S]*?)\s*<\/div>\s*\n\s*<!-- CTA Block -->/;
const PROSE_REGEX_ALT = /<div class="article-prose">\s*([\s\S]*?)\s*<\/div>\s*\n\s*<section class="article-cta"/;

function getStripInternalLinksRe() {
  const seg = getBlogSegment().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<a href="/${seg}/[^"]+/"[^>]*>([^<]+)</a>`, 'g');
}

function getArticlePaths() {
  const BLOG_DIR = path.join(ROOT, getBlogSegment());
  if (!fs.existsSync(BLOG_DIR)) {
    return [];
  }
  const entries = fs.readdirSync(BLOG_DIR, { withFileTypes: true });
  const paths = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const indexPath = path.join(BLOG_DIR, e.name, 'index.html');
      if (fs.existsSync(indexPath)) {
        paths.push(indexPath);
      }
    }
  }
  return paths;
}

function loadBlogs() {
  const raw = fs.readFileSync(BLOGS_JSON_PATH, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

function backfillFile(filePath, blogs, force) {
  let content = fs.readFileSync(filePath, 'utf8');
  const slug = path.basename(path.dirname(filePath));

  const match =
    content.match(ARTICLE_SYNC_RE) || content.match(PROSE_REGEX) || content.match(PROSE_REGEX_ALT);
  if (!match) {
    return { status: 'skip', reason: 'could not find article body block' };
  }

  const originalInnerHtml = match[1];
  let innerHtml = originalInnerHtml;
  if (force) {
    innerHtml = innerHtml.replace(getStripInternalLinksRe(), '$1');
  }

  const blogEntry = blogs.find((b) => b.slug === slug);
  const relatedSlugs = new Set(blogEntry?.related_posts || []);
  const injected = injectInternalLinks(innerHtml, blogs, slug, { relatedSlugs });

  if (injected === originalInnerHtml) {
    return { status: 'skip', reason: 'no links added' };
  }

  const newInner = match[0].replace(match[1], injected);
  const newContent = content.replace(match[0], newInner);

  fs.writeFileSync(filePath, newContent, 'utf8');
  return { status: 'updated' };
}

function run() {
  const force = process.argv.includes('--force');
  const blogs = loadBlogs();
  const paths = getArticlePaths();

  console.log(`Found ${paths.length} article(s), ${blogs.length} posts in blogs.json.${force ? ' (--force: re-injecting all)' : ''}`);

  let updated = 0;
  let skipped = 0;

  for (const p of paths) {
    const r = backfillFile(p, blogs, force);
    if (r.status === 'updated') {
      updated++;
      console.log(`  Updated: ${path.relative(ROOT, p)}`);
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

run();
