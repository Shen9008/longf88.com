'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/site.json'), 'utf8'));
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

const KEY = process.env.INDEXNOW_KEY || SITE.indexNow?.key;
const HOST = (SITE.indexNow?.host || new URL(SITE.domain).host);
const KEY_LOCATION =
  process.env.INDEXNOW_KEY_LOCATION ||
  SITE.indexNow?.keyLocation ||
  `${SITE.domain.replace(/\/$/, '')}/${KEY}.txt`;

const ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
];

function readSitemapUrls() {
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

async function submitBatch(endpoint, urlList) {
  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body,
  });

  const text = await response.text();
  return {
    endpoint,
    status: response.status,
    ok: response.ok,
    body: text,
  };
}

async function run() {
  if (!KEY) {
    throw new Error('Missing IndexNow key. Set config/site.json indexNow.key or INDEXNOW_KEY.');
  }

  const urls = readSitemapUrls();
  if (!urls.length) {
    throw new Error('No URLs found in sitemap.xml');
  }

  console.log(`Submitting ${urls.length} URL(s) to IndexNow`);
  console.log(`Host: ${HOST}`);
  console.log(`Key location: ${KEY_LOCATION}`);

  for (const endpoint of ENDPOINTS) {
    const result = await submitBatch(endpoint, urls);
    console.log(`${endpoint} -> HTTP ${result.status}${result.body ? ` (${result.body.trim()})` : ''}`);
    if (!result.ok && result.status !== 202) {
      process.exitCode = 1;
    }
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
