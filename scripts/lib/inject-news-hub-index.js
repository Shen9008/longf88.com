'use strict';

const fs = require('fs');
const path = require('path');
const { sortPostsByRecency } = require('./sort-posts.js');

const ROOT = path.resolve(__dirname, '../..');
const NEWS_HUB_PATH = path.join(ROOT, 'news', 'index.html');
const BLOGS_JSON_PATH = path.join(ROOT, 'assets', 'data', 'blogs.json');

const MARKER_START = '<!-- news-hub-index:start -->';
const MARKER_END = '<!-- news-hub-index:end -->';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Injects a crawlable list of all article links into news/index.html
 * so Google can discover posts without executing blog-loader.js.
 */
function injectNewsHubIndex(opts = {}) {
  const hubPath = opts.newsHubPath || NEWS_HUB_PATH;
  const blogsPath = opts.blogsPath || BLOGS_JSON_PATH;

  let blogs = [];
  try {
    blogs = JSON.parse(fs.readFileSync(blogsPath, 'utf8'));
    if (!Array.isArray(blogs)) blogs = [];
  } catch (err) {
    throw new Error(`Failed to read blogs.json: ${err.message}`);
  }

  blogs = sortPostsByRecency(blogs).filter((p) => (p.slug || '').trim());

  const items = blogs
    .map((p) => {
      const slug = String(p.slug).trim();
      const title = escapeHtml(p.title || slug);
      return `                <li><a href="/news/${encodeURI(slug)}/">${title}</a></li>`;
    })
    .join('\n');

  const block = `${MARKER_START}
        <section class="section news-hub__index" aria-labelledby="news-index-title">
            <div class="container">
                <header class="section__header">
                    <h2 id="news-index-title" class="section__title">All guides</h2>
                    <p class="section__desc">${blogs.length} articles on LongFu88 play, payments and safer habits.</p>
                </header>
                <ul class="news-hub__index-list">
${items}
                </ul>
            </div>
        </section>
        ${MARKER_END}`;

  let html = fs.readFileSync(hubPath, 'utf8');
  const startIdx = html.indexOf(MARKER_START);
  const endIdx = startIdx >= 0 ? html.indexOf(MARKER_END, startIdx) : -1;

  if (startIdx >= 0 && endIdx > startIdx) {
    html =
      html.slice(0, startIdx) +
      block +
      html.slice(endIdx + MARKER_END.length);
  } else {
    const anchor = '</main>';
    const mainClose = html.lastIndexOf(anchor);
    if (mainClose < 0) {
      throw new Error('Could not find </main> in news/index.html');
    }
    html =
      html.slice(0, mainClose) +
      `        ${block}\n    ` +
      html.slice(mainClose);
  }

  fs.writeFileSync(hubPath, html, 'utf8');
  return hubPath;
}

module.exports = { injectNewsHubIndex };
