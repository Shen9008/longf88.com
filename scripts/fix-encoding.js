'use strict';

/**
 * Repairs U+FFFD / mojibake in all article HTML bodies on disk.
 * Safe to re-run; future sync/render passes sanitize via format-content.js.
 */
const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const { sanitizeEncoding } = require('./lib/sanitize-text.js');
const { getBlogSegment } = require('./lib/site-origin.js');

const ROOT = path.resolve(__dirname, '..');
require('./lib/load-env.js');

function fixArticleFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  if (!html.includes('\uFFFD')) return { changed: false, count: 0 };

  const before = (html.match(/\uFFFD/g) || []).length;
  const fixed = sanitizeEncoding(html);
  if (fixed === html) return { changed: false, count: 0 };

  fs.writeFileSync(filePath, fixed, 'utf8');
  const after = (fixed.match(/\uFFFD/g) || []).length;
  return { changed: true, count: before - after };
}

function run() {
  const seg = getBlogSegment();
  const pattern = path.join(ROOT, seg, '**/index.html').replace(/\\/g, '/');
  const files = globSync(pattern);
  let changedFiles = 0;
  let fixedChars = 0;

  for (const filePath of files) {
    const result = fixArticleFile(filePath);
    if (result.changed) {
      changedFiles += 1;
      fixedChars += result.count;
      console.log('Fixed:', path.relative(ROOT, filePath), `(${result.count} chars)`);
    }
  }

  console.log(`Done. ${changedFiles} file(s) updated, ${fixedChars} replacement character(s) repaired.`);
}

run();
