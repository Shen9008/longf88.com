'use strict';

const { getBlogSegment } = require('./site-origin.js');

const EXCLUDED_PHRASES = new Set([
  'mansion88', 'casino', 'slots', 'online casino', 'live casino',
]);

/**
 * Injects internal links into article body HTML by matching phrases from blogs (focus_keyword, title) to other posts.
 * @param {string} html - Article body HTML
 * @param {Array} blogs - All posts from blogs.json
 * @param {string} currentSlug - Slug of current article (excluded from linking)
 * @param {object} [opts] - Options
 * @param {number} [opts.maxLinks=10] - Max internal links per article
 * @param {number} [opts.maxPerSlug=1] - Max 1 link per target slug
 * @param {Set|string[]} [opts.relatedSlugs] - Slugs from related_posts to prioritize
 * @param {string[]} [opts.excludePhrases] - Additional phrases to exclude from linking
 * @returns {string} HTML with internal links injected
 */
function injectInternalLinks(html, blogs, currentSlug, opts = {}) {
  const segment = getBlogSegment();
  const pathPrefix = `/${segment}/`;

  const maxLinks = opts.maxLinks ?? 10;
  const maxPerSlug = opts.maxPerSlug ?? 1;
  const relatedSlugs = opts.relatedSlugs instanceof Set
    ? opts.relatedSlugs
    : new Set(opts.relatedSlugs || []);
  const excluded = new Set([
    ...EXCLUDED_PHRASES,
    ...(opts.excludePhrases || []).map((p) => p.toLowerCase()),
  ]);

  if (!html || typeof html !== 'string') return html;
  if (!blogs?.length) return html;

  const phraseEntries = [];

  for (const b of blogs) {
    if (b.slug === currentSlug) continue;
    if (b.focus_keyword && b.focus_keyword.trim().length >= 3) {
      const phrase = b.focus_keyword.trim();
      const wordCount = phrase.split(/\s+/).length;
      if (wordCount < 2) continue;
      if (excluded.has(phrase.toLowerCase())) continue;
      phraseEntries.push({ phrase, slug: b.slug });
    }
    if (b.title) {
      const shortTitle = b.title.split(/\s+/).slice(0, 5).join(' ').trim();
      if (shortTitle.length >= 5 && shortTitle !== (b.focus_keyword || '').trim()) {
        const wordCount = shortTitle.split(/\s+/).length;
        if (wordCount < 2) continue;
        if (excluded.has(shortTitle.toLowerCase())) continue;
        phraseEntries.push({ phrase: shortTitle, slug: b.slug });
      }
    }
    if (Array.isArray(b.keywords)) {
      for (const kw of b.keywords) {
        const phrase = String(kw).trim();
        const wordCount = phrase.split(/\s+/).length;
        if (wordCount < 2) continue;
        if (excluded.has(phrase.toLowerCase())) continue;
        phraseEntries.push({ phrase, slug: b.slug });
      }
    }
  }

  const seen = new Set();
  const sorted = phraseEntries
    .filter((e) => {
      const key = e.phrase.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const aRelated = relatedSlugs.has(a.slug) ? 1 : 0;
      const bRelated = relatedSlugs.has(b.slug) ? 1 : 0;
      if (bRelated !== aRelated) return bRelated - aRelated;
      return b.phrase.length - a.phrase.length;
    });

  const linkCount = { total: 0, bySlug: {} };

  const escapedPrefix = pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingHrefRe = new RegExp(`href="${escapedPrefix}([^/"]+)/"`, 'g');
  let m;
  while ((m = existingHrefRe.exec(html)) !== null) {
    linkCount.bySlug[m[1]] = maxPerSlug;
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isInsideAnchor(textBeforeMatch) {
    const lastOpen = textBeforeMatch.lastIndexOf('<a ');
    const lastOpenAlt = textBeforeMatch.lastIndexOf('<a>');
    const lastClose = textBeforeMatch.lastIndexOf('</a>');
    const openIndex = Math.max(lastOpen, lastOpenAlt);
    if (openIndex === -1) return false;
    return lastClose === -1 || openIndex > lastClose;
  }

  function isInsideHeading(textBeforeMatch) {
    const tags = ['<h1', '<h2', '<h3', '<h4', '<h5', '<h6'];
    const closeTags = ['</h1>', '</h2>', '</h3>', '</h4>', '</h5>', '</h6>'];
    const lastOpen = Math.max(...tags.map((t) => textBeforeMatch.lastIndexOf(t)));
    const lastClose = Math.max(...closeTags.map((t) => textBeforeMatch.lastIndexOf(t)));
    if (lastOpen === -1) return false;
    return lastClose === -1 || lastOpen > lastClose;
  }

  let result = html;

  for (const { phrase, slug } of sorted) {
    if (linkCount.total >= maxLinks) break;
    if ((linkCount.bySlug[slug] || 0) >= maxPerSlug) continue;

    const re = new RegExp(escapeRegex(phrase), 'gi');
    let found = false;
    result = result.replace(re, (match, offset, fullString) => {
      if (found) return match;
      const before = fullString.substring(0, offset);
      if (isInsideAnchor(before)) return match;
      if (isInsideHeading(before)) return match;
      if (linkCount.total >= maxLinks) return match;
      if ((linkCount.bySlug[slug] || 0) >= maxPerSlug) return match;

      found = true;
      linkCount.total++;
      linkCount.bySlug[slug] = (linkCount.bySlug[slug] || 0) + 1;

      return `<a href="${pathPrefix}${slug}/" title="${phrase}">${match}</a>`;
    });
  }

  return result;
}

module.exports = { injectInternalLinks };
