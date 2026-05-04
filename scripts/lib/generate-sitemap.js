'use strict';

const fs = require('fs');
const path = require('path');
const { getSiteOrigin, getBlogSegment } = require('./site-origin.js');

const ROOT = path.resolve(__dirname, '../..');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const BLOGS_JSON_PATH = path.join(ROOT, 'assets/data/blogs.json');

const MARKER_START = '  <!-- Blog Posts -->';
const MARKER_END = '  <!-- End Blog Posts -->';

/**
 * Rebuilds the blog section of sitemap.xml from blogs.json.
 * Preserves all non-blog URL entries. Uses Blog Posts markers, or inserts them before </urlset>.
 */
function generateSitemap(opts = {}) {
  const sitemapPath = opts.sitemapPath || SITEMAP_PATH;
  const blogsPath = opts.blogsPath || BLOGS_JSON_PATH;
  const origin = opts.siteOrigin || getSiteOrigin();
  const segment = opts.blogSegment || getBlogSegment();
  const blogBase = `${origin}/${segment}/`;

  let blogs = [];
  try {
    const raw = fs.readFileSync(blogsPath, 'utf8');
    blogs = JSON.parse(raw);
    if (!Array.isArray(blogs)) blogs = [];
  } catch (err) {
    throw new Error(`Failed to read blogs.json: ${err.message}`);
  }

  let sitemap = fs.readFileSync(sitemapPath, 'utf8');

  const blogUrls = blogs.map((b) => {
    const slug = b.slug || '';
    const lastmod = b.published_date || '2025-01-01';
    return `  <url>
    <loc>${blogBase}${slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join('\n');

  const newBlogSection = `${MARKER_START}
${blogUrls}
${MARKER_END}
`;

  const startIdx = sitemap.indexOf(MARKER_START);
  const endIdx = startIdx >= 0 ? sitemap.indexOf(MARKER_END, startIdx) : -1;

  if (startIdx >= 0 && endIdx > startIdx) {
    const before = sitemap.slice(0, startIdx);
    const tail = sitemap.slice(endIdx + MARKER_END.length).replace(/^\s*\n/, '\n');
    const updated = before + newBlogSection + (tail.startsWith('\n') ? tail : `\n${tail}`);
    fs.writeFileSync(sitemapPath, updated, 'utf8');
    return sitemapPath;
  }

  const urlsetClose = sitemap.lastIndexOf('</urlset>');
  if (urlsetClose < 0) {
    throw new Error('Could not find </urlset> in sitemap.xml');
  }

  const beforeClose = sitemap.slice(0, urlsetClose).replace(/\s+$/, '\n');
  const closeAndAfter = sitemap.slice(urlsetClose);
  const insertion = `\n${newBlogSection}\n`;

  fs.writeFileSync(sitemapPath, beforeClose + insertion + closeAndAfter, 'utf8');
  return sitemapPath;
}

module.exports = { generateSitemap };
