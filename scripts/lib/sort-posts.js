'use strict';

/**
 * Primary blog index order: latest sync first (synced_at desc).
 * Tiebreakers: published_date, cms_updated_at, slug.
 */
function comparePostsByRecency(a, b) {
  const aHasSync = Boolean(a?.synced_at);
  const bHasSync = Boolean(b?.synced_at);
  if (aHasSync && !bHasSync) return -1;
  if (!aHasSync && bHasSync) return 1;

  if (aHasSync && bHasSync) {
    const sync =
      new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime();
    if (sync !== 0) return sync;
  }

  const pub =
    new Date(b?.published_date || 0).getTime() - new Date(a?.published_date || 0).getTime();
  if (pub !== 0) return pub;

  const cms =
    new Date(b?.cms_updated_at || 0).getTime() - new Date(a?.cms_updated_at || 0).getTime();
  if (cms !== 0) return cms;

  return String(b?.slug || '').localeCompare(String(a?.slug || ''));
}

function sortPostsByRecency(posts) {
  return [...posts].sort(comparePostsByRecency);
}

module.exports = {
  comparePostsByRecency,
  sortPostsByRecency,
};
