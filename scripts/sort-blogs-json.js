'use strict';

const fs = require('fs');
const path = require('path');

require('./lib/load-env.js');

const { ROOT } = require('./lib/load-env.js');
const { sortPostsByRecency } = require('./lib/sort-posts.js');
const { generateSitemap } = require('./lib/generate-sitemap.js');

const BLOGS_JSON_PATH = path.join(ROOT, 'assets/data/blogs.json');

function main() {
  const raw = fs.readFileSync(BLOGS_JSON_PATH, 'utf8');
  const blogs = JSON.parse(raw);
  if (!Array.isArray(blogs)) {
    throw new Error('blogs.json must be an array');
  }

  const sorted = sortPostsByRecency(blogs);
  fs.writeFileSync(BLOGS_JSON_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  generateSitemap();
  console.log(`Sorted ${sorted.length} post(s) in assets/data/blogs.json (latest sync first).`);
}

main();
