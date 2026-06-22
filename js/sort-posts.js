/**
 * Shared blog index sort: latest synced_at first.
 * Used by blog-loader.js and blog-related.js.
 */
(function (global) {
    'use strict';

    function comparePostsByRecency(a, b) {
        var aHasSync = Boolean(a && a.synced_at);
        var bHasSync = Boolean(b && b.synced_at);
        if (aHasSync && !bHasSync) return -1;
        if (!aHasSync && bHasSync) return 1;
        if (aHasSync && bHasSync) {
            var sync =
                new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime();
            if (sync !== 0) return sync;
        }
        var pub =
            new Date((b && b.published_date) || 0).getTime() -
            new Date((a && a.published_date) || 0).getTime();
        if (pub !== 0) return pub;
        var cms =
            new Date((b && b.cms_updated_at) || 0).getTime() -
            new Date((a && a.cms_updated_at) || 0).getTime();
        if (cms !== 0) return cms;
        return String((b && b.slug) || '').localeCompare(String((a && a.slug) || ''));
    }

    function sortPostsByRecency(posts) {
        return posts.slice().sort(comparePostsByRecency);
    }

    global.comparePostsByRecency = comparePostsByRecency;
    global.sortPostsByRecency = sortPostsByRecency;
})(typeof window !== 'undefined' ? window : globalThis);
