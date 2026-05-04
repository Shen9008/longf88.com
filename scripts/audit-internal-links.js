'use strict';

const fs = require('fs');
const path = require('path');
const { getBlogSegment } = require('./lib/site-origin.js');

const ROOT = path.resolve(__dirname, '..');

const ARTICLE_SYNC_RE = /<!-- article-sync-start -->\s*([\s\S]*?)\s*<!-- article-sync-end -->/;

const PROSE_REGEX = /<div class="article-prose">\s*([\s\S]*?)\s*<\/div>\s*\n\s*<!-- CTA Block -->/;
const PROSE_REGEX_ALT = /<div class="article-prose">\s*([\s\S]*?)\s*<\/div>\s*\n\s*<section class="article-cta"/;

function getInternalLinkRe() {
  const seg = getBlogSegment().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`href="/${seg}/([^/"]+)/"`, 'g');
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

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const slug = path.basename(path.dirname(filePath));

  const match =
    content.match(ARTICLE_SYNC_RE) || content.match(PROSE_REGEX) || content.match(PROSE_REGEX_ALT);
  if (!match) {
    return { slug, count: 0, linkedSlugs: [], error: 'could not find article body block' };
  }

  const proseHtml = match[1];
  const linkedSlugs = [];
  const INTERNAL_LINK_RE = getInternalLinkRe();
  let m;
  while ((m = INTERNAL_LINK_RE.exec(proseHtml)) !== null) {
    linkedSlugs.push(m[1]);
  }

  return { slug, count: linkedSlugs.length, linkedSlugs };
}

function run() {
  const paths = getArticlePaths();
  const results = paths.map((p) => auditFile(p));

  results.sort((a, b) => a.count - b.count);

  console.log(`Audit report: ${results.length} articles\n`);

  let zeroCount = 0;
  for (const r of results) {
    const status = r.count === 0 ? '  <-- needs attention' : '';
    console.log(`  ${r.slug.padEnd(55)} ${String(r.count).padStart(2)} links${status}`);
    if (r.count === 0) zeroCount++;
  }

  console.log(`\nSummary: ${zeroCount} article(s) with 0 internal links.`);
}

run();
