'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(ROOT, '.env.local') });

/**
 * Folder name under project root where article HTML lives (e.g. blog, news).
 * From BLOG_BASE_PATH; sanitized. Default "blog".
 */
function getBlogSegment() {
  const raw = (process.env.BLOG_BASE_PATH || 'blog').trim();
  const segment = raw.replace(/^\/+|\/+$/g, '');
  if (!segment || !/^[a-z0-9][a-z0-9-]*$/i.test(segment)) {
    return 'blog';
  }
  return segment;
}

/**
 * Canonical site origin (no trailing slash) for sitemaps, canonical URLs, share links.
 * Env: SITE_BASE_URL, then SITE_ORIGIN, then config/site.json domain,
 * then https://SITE_DOMAIN.
 */
function getSiteOrigin() {
  if (process.env.SITE_BASE_URL) {
    return String(process.env.SITE_BASE_URL).replace(/\/+$/, '');
  }
  if (process.env.SITE_ORIGIN) {
    return String(process.env.SITE_ORIGIN).replace(/\/+$/, '');
  }
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'config/site.json'), 'utf8');
    const site = JSON.parse(raw);
    if (site.domain) {
      return String(site.domain).replace(/\/+$/, '');
    }
  } catch (_) {
    /* fall through */
  }
  if (process.env.SITE_DOMAIN) {
    const d = String(process.env.SITE_DOMAIN).trim().replace(/\/+$/, '');
    if (!d) return 'https://longf88.com';
    return /^https?:\/\//i.test(d) ? d.replace(/\/+$/, '') : `https://${d}`;
  }
  return 'https://longf88.com';
}

/**
 * Normalizes a URL or host string to a lowercase hostname (no leading www).
 */
function normalizeSiteHostname(input) {
  if (input == null || input === '') return '';
  let s = String(input).trim().replace(/\/+$/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).hostname.replace(/^www\./i, '').toLowerCase();
    } catch (_) {
      return '';
    }
  }
  return s.split('/')[0].replace(/^www\./i, '').toLowerCase();
}

/**
 * Hostname for Strapi post filtering (.env SITE_DOMAIN). Empty disables that filter.
 */
function getSyncSiteHostname() {
  const raw = (process.env.SITE_DOMAIN || '').trim();
  if (!raw) return '';
  return normalizeSiteHostname(raw);
}

module.exports = {
  getSiteOrigin,
  getBlogSegment,
  getSyncSiteHostname,
  normalizeSiteHostname,
  ROOT,
};
