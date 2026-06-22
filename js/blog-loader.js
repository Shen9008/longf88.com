/**
 * Loads posts from ../assets/data/blogs.json into #blog-grid (news / guides listing).
 * Paginates: PAGE_SIZE per page; URL ?page=2 for deep links.
 */
(function () {
    'use strict';

    var PAGE_SIZE = 6;

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

    function formatDatePublished(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    var DEFAULT_BLOG_IMAGE = '/images/blog-default.png';

    function postImageSrc(post) {
        var img = (post.featured_image || '').trim();
        if (!img) return DEFAULT_BLOG_IMAGE;
        if (/^https?:\/\//i.test(img)) return img;
        return img.charAt(0) === '/' ? img : '/' + img;
    }

    function buildCard(post) {
        var slug = post.slug || '';
        if (!slug) return null;

        var art = document.createElement('article');
        art.className = 'feature-card feature-card--visual news-card';

        var href = encodeURI('/news/' + slug + '/');
        var imgSrc = postImageSrc(post);
        var imgAlt = escapeHtml(post.title || 'LongFu88 guide');

        art.innerHTML =
            '<a href="' +
            href +
            '" class="feature-card__thumb news-card__thumb">' +
            '<img src="' +
            escapeHtml(imgSrc) +
            '" alt="' +
            imgAlt +
            '" width="1672" height="941" loading="lazy" decoding="async"></a>' +
            '<div class="feature-card__title"><a href="' +
            href +
            '">' +
            escapeHtml(post.title || 'Untitled') +
            '</a></div>' +
            '<div class="feature-card__meta news-card__meta">' +
            escapeHtml(formatDatePublished(post.published_date)) +
            (post.reading_time ? ' · ' + escapeHtml(post.reading_time) : '') +
            '</div>' +
            '<p class="feature-card__text news-card__excerpt">' +
            escapeHtml(
                post.excerpt || post.meta_description || 'Open for the full guide.'
            ) +
            '</p>' +
            '<a class="news-card__cta" href="' +
            href +
            '"><span class="news-card__cta-text">Read article</span><span class="news-card__cta-arrow" aria-hidden="true">→</span></a>';

        return art;
    }

    function pageHref(pageNum) {
        var u;
        try {
            u = new URL(window.location.href);
        } catch (e) {
            return pageNum <= 1 ? window.location.pathname : window.location.pathname + '?page=' + pageNum;
        }
        if (pageNum <= 1) {
            u.searchParams.delete('page');
        } else {
            u.searchParams.set('page', String(pageNum));
        }
        return u.pathname + u.search + u.hash;
    }

    function readPageFromUrl() {
        try {
            var p = parseInt(new URLSearchParams(window.location.search).get('page'), 10);
            if (!p || p < 1) return 1;
            return p;
        } catch (e) {
            return 1;
        }
    }

    function syncUrlToPage(page) {
        var next = pageHref(page);
        var cur = window.location.pathname + window.location.search + window.location.hash;
        if (next !== cur) {
            try {
                window.history.replaceState({}, '', next);
            } catch (e) {}
        }
    }

    /** @returns {(number|null)[]} null = ellipsis gap */
    function pageSequence(totalPages, current) {
        if (totalPages <= 9) {
            var all = [];
            var i;
            for (i = 1; i <= totalPages; i++) all.push(i);
            return all;
        }
        var raw = [1, totalPages, current - 1, current, current + 1];
        var set = {};
        raw.forEach(function (n) {
            if (n >= 1 && n <= totalPages) set[n] = true;
        });
        var nums = Object.keys(set)
            .map(function (k) {
                return parseInt(k, 10);
            })
            .sort(function (a, b) {
                return a - b;
            });
        var out = [];
        for (var j = 0; j < nums.length; j++) {
            if (j > 0 && nums[j] - nums[j - 1] > 1) {
                out.push(null);
            }
            out.push(nums[j]);
        }
        return out;
    }

    function renderPagination(navEl, totalPages, current) {
        if (!navEl) return;

        if (totalPages <= 1) {
            navEl.hidden = true;
            navEl.innerHTML = '';
            return;
        }

        navEl.hidden = false;
        var seq = pageSequence(totalPages, current);
        var items = [];

        if (current <= 1) {
            items.push(
                '<li class="news-pagination__item"><span class="news-pagination__inactive" aria-disabled="true">Previous</span></li>'
            );
        } else {
            items.push(
                '<li class="news-pagination__item"><a class="news-pagination__link news-pagination__link--prev" href="' +
                    escapeHtml(pageHref(current - 1)) +
                    '">Previous</a></li>'
            );
        }

        seq.forEach(function (entry) {
            if (entry === null) {
                items.push(
                    '<li class="news-pagination__item"><span class="news-pagination__ellipsis" aria-hidden="true">⋯</span></li>'
                );
                return;
            }
            if (entry === current) {
                items.push(
                    '<li class="news-pagination__item"><span class="news-pagination__link news-pagination__link--current" aria-current="page">' +
                        entry +
                        '</span></li>'
                );
            } else {
                items.push(
                    '<li class="news-pagination__item"><a class="news-pagination__link" href="' +
                        escapeHtml(pageHref(entry)) +
                        '">' +
                        entry +
                        '</a></li>'
                );
            }
        });

        if (current >= totalPages) {
            items.push(
                '<li class="news-pagination__item"><span class="news-pagination__inactive" aria-disabled="true">Next</span></li>'
            );
        } else {
            items.push(
                '<li class="news-pagination__item"><a class="news-pagination__link news-pagination__link--next" href="' +
                    escapeHtml(pageHref(current + 1)) +
                    '">Next</a></li>'
            );
        }

        navEl.innerHTML = '<ul class="news-pagination__list">' + items.join('') + '</ul>';
    }

    function comparePostsByRecency(a, b) {
        if (typeof window !== 'undefined' && typeof window.comparePostsByRecency === 'function') {
            return window.comparePostsByRecency(a, b);
        }
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

    function sortBlogPosts(posts) {
        if (typeof window !== 'undefined' && typeof window.sortPostsByRecency === 'function') {
            return window.sortPostsByRecency(posts);
        }
        return posts.slice().sort(comparePostsByRecency);
    }

    function renderFeatured(valid, featuredEl, featuredSection) {
        if (!featuredEl) return;
        featuredEl.innerHTML = '';
        var featured = valid.slice(0, 3);
        if (featured.length === 0) {
            if (featuredSection) featuredSection.hidden = true;
            return;
        }
        if (featuredSection) featuredSection.hidden = false;
        featured.forEach(function (post) {
            var art = buildCard(post);
            if (art) featuredEl.appendChild(art);
        });
    }

    function run() {
        var grid = document.getElementById('blog-grid');
        var status = document.getElementById('blog-grid-status');
        var navEl = document.getElementById('blog-pagination');
        var featuredEl = document.getElementById('blog-featured');
        var featuredSection = document.querySelector('.news-hub__featured');
        if (!grid) return;

        var base = computeAssetBase(window.location.pathname || '');
        var jsonUrl = base + 'assets/data/blogs.json?v=sync-sort-3';

        fetch(jsonUrl, { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) throw new Error(jsonUrl + ' HTTP ' + r.status);
                return r.json();
            })
            .then(function (blogs) {
                if (!Array.isArray(blogs) || blogs.length === 0) {
                    if (status) {
                        status.textContent =
                            'No articles published yet — check back soon.';
                        status.classList.add('news-hub__status--empty');
                        status.hidden = false;
                    }
                    grid.innerHTML = '';
                    renderFeatured([], featuredEl, featuredSection);
                    if (navEl) {
                        navEl.hidden = true;
                        navEl.innerHTML = '';
                    }
                    return;
                }

                if (status) {
                    status.classList.remove('news-hub__status--empty');
                }

                blogs = sortBlogPosts(blogs);

                var valid = blogs.filter(function (p) {
                    return (p.slug || '').trim().length > 0;
                });

                renderFeatured(valid, featuredEl, featuredSection);

                var total = valid.length;
                var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
                var page = readPageFromUrl();
                if (page > totalPages) {
                    page = totalPages;
                    syncUrlToPage(page);
                }

                var start = (page - 1) * PAGE_SIZE;
                var end = Math.min(start + PAGE_SIZE, total);
                var slice = valid.slice(start, end);

                if (status) {
                    status.innerHTML = '';
                    status.hidden = true;
                }

                grid.innerHTML = '';
                slice.forEach(function (post) {
                    var art = buildCard(post);
                    if (art) grid.appendChild(art);
                });

                renderPagination(navEl, totalPages, page);
            })
            .catch(function () {
                if (status) {
                    status.textContent =
                        'Could not load assets/data/blogs.json. Serve the site from the project root (e.g. npm run serve).';
                    status.classList.add('news-hub__status--empty');
                    status.hidden = false;
                }
                renderFeatured([], featuredEl, featuredSection);
                if (navEl) {
                    navEl.hidden = true;
                    navEl.innerHTML = '';
                }
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
