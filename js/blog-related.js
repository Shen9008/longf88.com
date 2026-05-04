/**
 * Reads assets/data/blogs.json and renders related-posts for article pages (data-blog-slug).
 */
(function () {
    'use strict';

    function computeAssetBase(pathname) {
        var pathStr = (pathname || '').replace(/\/+$/, '');
        var parts = pathStr.split('/').filter(Boolean);
        if (
            parts.length &&
            /\.[a-z0-9]+$/i.test(parts[parts.length - 1])
        ) {
            parts.pop();
        }
        var depth = parts.length;
        var out = '';
        var i;
        for (i = 0; i < depth; i++) out += '../';
        return out;
    }

    function relatedPostsFor(blogs, slug) {
        if (!blogs || !slug) return [];

        var map = {};
        blogs.forEach(function (b) {
            if (b && b.slug) map[b.slug] = b;
        });

        var cur = map[slug];
        var out = [];
        var seen = {};
        seen[slug] = true;

        (cur.related_posts || []).forEach(function (relSlug) {
            if (!relSlug || seen[relSlug] || out.length >= 3) return;
            var b = map[relSlug];
            if (b) {
                out.push(b);
                seen[relSlug] = true;
            }
        });

        if (out.length >= 3) return out.slice(0, 3);

        blogs.forEach(function (b) {
            if (out.length >= 3) return;
            if (!b.slug || seen[b.slug]) return;
            out.push(b);
            seen[b.slug] = true;
        });

        return out.slice(0, 3);
    }

    function run() {
        var slug = document.body.getAttribute('data-blog-slug') || '';
        var root = document.getElementById('related-posts-root');
        var listEl = document.getElementById('related-posts');
        if (!slug || !root || !listEl) return;

        var base = computeAssetBase(window.location.pathname || '');
        var jsonUrl = base + 'assets/data/blogs.json';

        fetch(jsonUrl, { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) throw new Error(jsonUrl + ' HTTP ' + r.status);
                return r.json();
            })
            .then(function (blogs) {
                if (!Array.isArray(blogs) || blogs.length === 0) return;

                var items = relatedPostsFor(blogs, slug);
                if (items.length === 0) return;

                root.hidden = false;

                listEl.innerHTML = items
                    .map(function (b) {
                        var href = '../' + encodeURIComponent(String(b.slug)) + '/';
                        return (
                            '<li class="related-posts__item">' +
                            '<a class="related-posts__link" href="' +
                            href +
                            '">' +
                            escapeHtml(b.title || b.slug) +
                            '</a>' +
                            '<div class="related-posts__excerpt">' +
                            escapeHtml(b.excerpt || b.meta_description || '') +
                            '</div></li>'
                        );
                    })
                    .join('');
            })
            .catch(function () {});
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
