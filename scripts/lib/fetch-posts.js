'use strict';

require('./load-env.js');

const { getSyncSiteHostname, normalizeSiteHostname } = require('./site-origin.js');

const API_BASE = process.env.STRAPI_API_URL || 'http://localhost:1337/api';
const API_TOKEN = process.env.STRAPI_API_TOKEN;
/** UID of the REST collection (no leading slash): e.g. posts, mansion88-posts */
const API_COLLECTION =
  process.env.STRAPI_COLLECTION || process.env.BLOG_COLLECTION || 'mansion88-posts';

/** Strapi attribute matched against SITE_DOMAIN (hostname). Used when STRAPI_SITE_FILTER_STYLE=field. */
const SITE_DOMAIN_FIELD =
  process.env.STRAPI_SITE_DOMAIN_FIELD || 'site_domain';

/** relation (default): API filters[site][domain][$eq]. field: client-side STRAPI_SITE_DOMAIN_FIELD only. */
function getSiteFilterStyle() {
  const raw = (process.env.STRAPI_SITE_FILTER_STYLE || 'relation').trim().toLowerCase();
  return raw === 'field' ? 'field' : 'relation';
}

function siteFilterDisabled() {
  return /^(1|true|yes)$/i.test(process.env.STRAPI_SKIP_SITE_FILTER || '')
    || /^(1|true|yes)$/i.test(process.env.SKIP_POSTS_SITE_FILTER || '');
}

function postMatchesSyncSiteField(post) {
  if (siteFilterDisabled()) return true;
  const expected = getSyncSiteHostname();
  if (!expected) return true;
  const raw = post[SITE_DOMAIN_FIELD];
  if (raw == null || raw === '') return false;
  const got = normalizeSiteHostname(typeof raw === 'string' ? raw : String(raw));
  return got === expected;
}

function getRelationFilterParts() {
  const filterKey = String(process.env.POSTS_SITE_FILTER_KEY || '').trim();
  if (filterKey) {
    const match = filterKey.match(/^filters\[([^\]]+)\]\[([^\]]+)\]\[\$eq\]$/);
    if (match) {
      return { rel: match[1], domainAttr: match[2] };
    }
  }
  const rel = (process.env.STRAPI_SITE_RELATION || 'site').trim() || 'site';
  const domainAttr =
    (process.env.STRAPI_SITE_RELATION_DOMAIN_FIELD || 'domain').trim() || 'domain';
  return { rel, domainAttr };
}

function applyRelationSiteFilter(url, hostname) {
  const { rel, domainAttr } = getRelationFilterParts();
  url.searchParams.set(`filters[${rel}][${domainAttr}][$eq]`, hostname);
  url.searchParams.set(`populate[${rel}]`, process.env.STRAPI_SITE_POPULATE || '*');
}

/** Default Strapi media field on post types (camelCase). Override via STRAPI_MEDIA_POPULATE. */
const DEFAULT_MEDIA_POPULATE_FIELDS = ['featuredImage'];

/** Comma-separated Strapi media attribute names. Unset/empty → featuredImage; none/0/false → skip populate. */
function getMediaPopulateFields() {
  const raw = process.env.STRAPI_MEDIA_POPULATE;
  if (raw != null && /^(none|0|false)$/i.test(String(raw).trim())) return [];
  if (raw != null && String(raw).trim() !== '') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_MEDIA_POPULATE_FIELDS;
}

function applyMediaPopulate(url) {
  for (const field of getMediaPopulateFields()) {
    // Strapi v5 media: populate[field]=* fails; nested populate is required.
    url.searchParams.set(`populate[${field}][populate]`, '*');
  }
}

function assertSiteFilterConfig() {
  if (!/^(1|true|yes)$/i.test(process.env.SYNC_REQUIRE_SITE_FILTER || '')) {
    return;
  }

  const errors = [];
  const host = getSyncSiteHostname();

  if (!host) {
    errors.push('SITE_DOMAIN is empty');
  }
  if (siteFilterDisabled()) {
    errors.push('Site filter is disabled via SKIP_POSTS_SITE_FILTER or STRAPI_SKIP_SITE_FILTER');
  }
  if (host && !siteFilterDisabled() && getSiteFilterStyle() !== 'relation') {
    errors.push('SYNC_REQUIRE_SITE_FILTER requires STRAPI_SITE_FILTER_STYLE=relation (API filter)');
  }

  if (errors.length) {
    throw new Error(`Site filter required but misconfigured: ${errors.join('; ')}`);
  }
}

/**
 * Fetches all published entries from Strapi REST.
 * Collection: STRAPI_COLLECTION (default mansion88-posts).
 * Pagination sorted by publishedAt ascending.
 *
 * When SITE_DOMAIN is set and site filter skip is unset:
 * - STRAPI_SITE_FILTER_STYLE=relation (default): Strapi API filters[site][domain][$eq]=host (+ populate site).
 * - STRAPI_SITE_FILTER_STYLE=field: client filter on STRAPI_SITE_DOMAIN_FIELD (default site_domain).
 *
 * @param {object} [opts] - Options
 * @param {string} [opts.baseUrl] - Override API base URL
 * @param {string} [opts.collection] - Override collection UID
 * @returns {Promise<Array>} Array of Strapi post objects
 */
async function fetchPosts(opts = {}) {
  assertSiteFilterConfig();

  const base = (opts.baseUrl || API_BASE).replace(/\/+$/, '');
  const collection = opts.collection || API_COLLECTION;
  const endpoint = `${base}/${collection}`;
  const allPosts = [];
  let page = 1;
  const pageSize = 100;

  const headers = {};
  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  const expectedHost = getSyncSiteHostname();
  const useRelationApiFilter =
    expectedHost &&
    !siteFilterDisabled() &&
    getSiteFilterStyle() === 'relation';

  while (true) {
    const url = new URL(endpoint);
    url.searchParams.set('sort', 'publishedAt:asc');
    url.searchParams.set('pagination[page]', String(page));
    url.searchParams.set('pagination[pageSize]', String(pageSize));
    if (useRelationApiFilter) {
      applyRelationSiteFilter(url, expectedHost);
    }
    applyMediaPopulate(url);

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      const snippet = (await response.text()).slice(0, 400);
      throw new Error(
        `Strapi API error: ${response.status} ${response.statusText}${snippet ? ` — ${snippet}` : ''}`,
      );
    }

    const data = await response.json();
    const raw = Array.isArray(data) ? data : (data.data || []);
    const posts = Array.isArray(raw) ? raw : raw ? [raw] : [];

    for (const p of posts) {
      if (!p || typeof p !== 'object') continue;
      const attrs = { ...(p.attributes || {}) };
      for (const k of Object.keys(p)) {
        if (k === 'attributes' || k === 'id') continue;
        if (attrs[k] === undefined || attrs[k] === null) {
          attrs[k] = p[k];
        }
      }
      const id = p.id != null ? p.id : p.documentId;
      allPosts.push({ id, ...attrs });
    }

    const pagination = data.meta?.pagination || data.pagination;
    if (!pagination || page >= (pagination.pageCount || 1)) break;
    page++;
  }

  if (
    expectedHost &&
    !siteFilterDisabled() &&
    getSiteFilterStyle() === 'field'
  ) {
    const before = allPosts.length;
    const filtered = allPosts.filter(postMatchesSyncSiteField);
    const dropped = before - filtered.length;
    if (dropped) {
      console.log(
        `Site filter (${SITE_DOMAIN_FIELD} → host "${expectedHost}"): omitted ${dropped} post(s).`,
      );
    }
    return filtered;
  }

  return allPosts;
}

module.exports = {
  fetchPosts,
  assertSiteFilterConfig,
  siteFilterDisabled,
  getRelationFilterParts,
};
