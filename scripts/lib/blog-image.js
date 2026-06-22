'use strict';

/** Site-relative path used when Strapi (or blogs.json) has no featured image. */
const DEFAULT_BLOG_IMAGE = 'images/blog-default.png';

const STRAPI_MEDIA_FIELDS = [
  'featuredImage',
  'featured_image',
  'cover',
  'coverImage',
  'image',
  'thumbnail',
];

/**
 * @param {unknown} value - Strapi media relation, attributes blob, or URL string
 * @returns {string}
 */
function pickStrapiMediaUrl(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();

  if (typeof value !== 'object') return '';

  const direct = value.url || value.src;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const data = value.data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const url = pickStrapiMediaUrl(item);
      if (url) return url;
    }
    return '';
  }

  if (data && typeof data === 'object') {
    const fromData = pickStrapiMediaUrl(data);
    if (fromData) return fromData;
  }

  const attrs = value.attributes;
  if (attrs && typeof attrs === 'object') {
    const fromAttrs = attrs.url
      || attrs.formats?.large?.url
      || attrs.formats?.medium?.url
      || attrs.formats?.small?.url;
    if (typeof fromAttrs === 'string' && fromAttrs.trim()) return fromAttrs.trim();
  }

  return '';
}

/**
 * @param {object} post
 * @returns {string}
 */
function extractFeaturedImageFromPost(post) {
  if (!post || typeof post !== 'object') return '';

  if (typeof post.featured_image === 'string' && post.featured_image.trim()) {
    return post.featured_image.trim();
  }

  for (const field of STRAPI_MEDIA_FIELDS) {
    const url = pickStrapiMediaUrl(post[field]);
    if (url) return url;
  }

  return '';
}

/**
 * @param {string} url
 * @returns {string}
 */
function absoluteStrapiMediaUrl(url) {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const api = process.env.STRAPI_API_URL || '';
  const origin = api.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
  if (!origin) return url;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Resolved featured image: Strapi/media URL when set, otherwise site default path.
 * @param {object} post
 * @returns {string}
 */
function resolveBlogImagePath(post) {
  const custom = extractFeaturedImageFromPost(post);
  if (custom) return absoluteStrapiMediaUrl(custom);
  return DEFAULT_BLOG_IMAGE;
}

/**
 * @param {string} origin - e.g. https://longf88.com
 * @param {object} post
 * @returns {string}
 */
function resolveBlogImageUrl(origin, post) {
  const resolved = resolveBlogImagePath(post);
  if (/^https?:\/\//i.test(resolved)) return resolved;
  const base = String(origin || '').replace(/\/+$/, '');
  const path = resolved.replace(/^\//, '');
  return `${base}/${path}`;
}

/**
 * Relative path from article HTML (news/slug/index.html → ../../images/...).
 * @param {object} post
 * @returns {string}
 */
function resolveBlogImageRelFromArticle(post) {
  const resolved = resolveBlogImagePath(post);
  if (/^https?:\/\//i.test(resolved)) return resolved;
  const path = resolved.replace(/^\//, '');
  return `../../${path}`;
}

module.exports = {
  DEFAULT_BLOG_IMAGE,
  extractFeaturedImageFromPost,
  resolveBlogImagePath,
  resolveBlogImageUrl,
  resolveBlogImageRelFromArticle,
};
