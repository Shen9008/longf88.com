'use strict';

const fs = require('fs');
const path = require('path');
const { getBlogSegment } = require('./lib/site-origin.js');

const ROOT = path.resolve(__dirname, '..');

const RELATED_BLOCK = `
          <!-- Related Posts (client-side) -->
          <section class="article-related" id="related-posts" aria-label="Related posts">
            <p style="color: var(--color-gray-500); font-size: var(--text-sm);">Loading related posts...</p>
          </section>
`;

const SCRIPT_TAG = '  <script src="../../assets/js/components/related-posts.js" defer></script>';

// Insert after CTA </section>, before article-main </div>
// Pattern A: with "<!-- Sticky Sidebar -->" comment
// Pattern B: direct <aside class="article-sidebar">
const CTA_END_PATTERNS = [
  [/(<\/section>\s*)(<\/div>\s*\n\s*<!-- Sticky Sidebar -->)/, `$1\n${RELATED_BLOCK}\n        $2`],
  [/(<\/section>\s*)(<\/div>\s*\n\s*<aside class="article-sidebar">)/, `$1\n${RELATED_BLOCK}\n        $2`],
];

// Insert script after sidebar-loader.js
const SCRIPT_INSERT_PATTERN = /(<script src="\.\.\/\.\.\/assets\/js\/sidebar-loader\.js" defer><\/script>)/;
const SCRIPT_INSERT = `$1\n  ${SCRIPT_TAG}`;

function getArticlePaths() {
  const BLOG_DIR = path.join(ROOT, getBlogSegment());
  if (!fs.existsSync(BLOG_DIR)) return [];
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

function backfillFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('id="related-posts"')) {
    return { file: filePath, status: 'skip', reason: 'already has related-posts' };
  }

  let modified = false;

  let patternMatched = false;
  for (const [pattern, replacement] of CTA_END_PATTERNS) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      patternMatched = true;
      modified = true;
      break;
    }
  }
  if (!patternMatched) {
    return { file: filePath, status: 'skip', reason: 'could not find CTA end pattern' };
  }

  if (!content.includes('related-posts.js')) {
    content = content.replace(SCRIPT_INSERT_PATTERN, SCRIPT_INSERT);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { file: filePath, status: 'updated' };
  }

  return { file: filePath, status: 'skip', reason: 'no changes' };
}

function run() {
  const paths = getArticlePaths();
  console.log(`Found ${paths.length} article(s) to process.`);

  const results = { updated: 0, skip: 0 };
  for (const p of paths) {
    const r = backfillFile(p);
    if (r.status === 'updated') {
      results.updated++;
      console.log(`  Updated: ${path.relative(ROOT, p)}`);
    } else {
      results.skip++;
      if (r.reason && r.reason !== 'already has related-posts') {
        console.log(`  Skip ${path.relative(ROOT, p)}: ${r.reason}`);
      }
    }
  }

  console.log(`\nDone. Updated: ${results.updated}, Skipped: ${results.skip}`);
}

run();
