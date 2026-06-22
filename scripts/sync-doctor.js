'use strict';

const path = require('path');

require('./lib/load-env.js');

const { ROOT } = require('./lib/load-env.js');

const { getBlogSegment, getSiteOrigin, getSyncSiteHostname } = require('./lib/site-origin.js');
const { probeStrapiApi } = require('./lib/fetch-posts.js');

function siteFilterSkipped() {
  return /^(1|true|yes)$/i.test(process.env.STRAPI_SKIP_SITE_FILTER || '')
    || /^(1|true|yes)$/i.test(process.env.SKIP_POSTS_SITE_FILTER || '');
}

function getCollection() {
  return process.env.STRAPI_COLLECTION || process.env.BLOG_COLLECTION || 'mansion88-posts';
}

function buildSampleApiUrl() {
  const base = (process.env.STRAPI_API_URL || 'http://localhost:1337/api').replace(/\/+$/, '');
  const collection = getCollection();
  const url = new URL(`${base}/${collection}`);
  url.searchParams.set('sort', 'publishedAt:asc');
  url.searchParams.set('pagination[page]', '1');
  url.searchParams.set('pagination[pageSize]', '1');

  const host = getSyncSiteHostname();
  if (host && !siteFilterSkipped()) {
    const rel = (process.env.STRAPI_SITE_RELATION || 'site').trim() || 'site';
    const dom = (process.env.STRAPI_SITE_RELATION_DOMAIN_FIELD || 'domain').trim() || 'domain';
    url.searchParams.set(`filters[${rel}][${dom}][$eq]`, host);
  }

  return url.toString();
}

function assertStrictSiteFilter() {
  if (!/^(1|true|yes)$/i.test(process.env.SYNC_REQUIRE_SITE_FILTER || '')) {
    return;
  }

  const errors = [];

  if (!getSyncSiteHostname()) {
    errors.push('SITE_DOMAIN is empty but SYNC_REQUIRE_SITE_FILTER=1');
  }
  if (siteFilterSkipped()) {
    errors.push('Site filter skip flag is enabled (SKIP_POSTS_SITE_FILTER or STRAPI_SKIP_SITE_FILTER)');
  }

  if (errors.length) {
    console.error('Site filter configuration failed:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}

function main() {
  console.log('Blog sync configuration\n');

  console.log(`  SITE_DOMAIN:        ${process.env.SITE_DOMAIN || '(not set)'}`);
  console.log(`  SITE_BASE_URL:      ${process.env.SITE_BASE_URL || getSiteOrigin()}`);
  console.log(`  BLOG_BASE_PATH:     ${process.env.BLOG_BASE_PATH || '(auto)'}`);
  console.log(`  Blog segment:       ${getBlogSegment()}/`);
  console.log(`  STRAPI_API_URL:     ${process.env.STRAPI_API_URL || '(not set — default http://localhost:1337/api)'}`);
  console.log(`  STRAPI_API_TOKEN:   ${process.env.STRAPI_API_TOKEN ? '(set)' : '(not set)'}`);
  console.log(`  STRAPI_COLLECTION:  ${getCollection()}`);
  console.log(`  Site filter skip:   ${siteFilterSkipped() ? 'yes' : 'no'}`);
  console.log(`  SYNC_REQUIRE_SITE_FILTER: ${process.env.SYNC_REQUIRE_SITE_FILTER || '(not set)'}`);
  console.log(`\n  Sample API URL:\n  ${buildSampleApiUrl()}\n`);

  assertStrictSiteFilter();
  console.log('Configuration OK.');

  if (process.env.STRAPI_API_URL && process.env.STRAPI_API_TOKEN) {
    probeStrapiApi()
      .then(() => {
        console.log('Strapi API probe OK.');
      })
      .catch((err) => {
        console.error(`Strapi API probe failed: ${err.message}`);
        process.exit(1);
      });
    return;
  }

  console.log('Strapi API probe skipped (STRAPI_API_URL or STRAPI_API_TOKEN not set).');
}

main();
