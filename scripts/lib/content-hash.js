'use strict';

const crypto = require('crypto');

function hashContent(content) {
  return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
}

function getCmsUpdatedAt(raw) {
  const val = raw.updatedAt || raw.publishedAt || '';
  if (!val) return '';
  const t = new Date(val).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(val).toISOString();
}

function postChanged(existing, raw) {
  const apiHash = hashContent(raw.content);
  const apiUpdated = getCmsUpdatedAt(raw);
  return apiHash !== (existing.content_hash || '') || apiUpdated !== (existing.cms_updated_at || '');
}

module.exports = { hashContent, getCmsUpdatedAt, postChanged };
