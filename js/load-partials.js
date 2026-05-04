/**
 * longf88.com — load SVG sprite, header, footer, optional CTA after first main section.
 * body[data-page] sets active nav. Works from site root (add ../ for subfolders later).
 * Partials use .fragment (not .html) so VS Code Live Server cannot inject SVG-breaking reload scripts into fetch() responses (see vscode-live-server #182 / #684).
 */
(function () {
    'use strict';

    var pathname = window.location.pathname || '';

    function computeAssetBase(pathStr) {
        var pathNormalized = (pathStr || '').replace(/\/+$/, '');
        var parts = pathNormalized.split('/').filter(Boolean);
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

    var base = computeAssetBase(pathname);

    function rewriteLinks(html) {
        if (!base) return html;
        html = html.replace(/\shref="([^"]+)"/g, function (full, href) {
            if (
                /^https?:\/\//i.test(href) ||
                /^mailto:/i.test(href) ||
                href.charAt(0) === '#' ||
                href.startsWith('//')
            )
                return full;
            if (href.charAt(0) === '/') return full;
            if (href.startsWith('../')) return full;
            return ' href="' + base + href + '"';
        });
        html = html.replace(/\ssrc="images\//g, ' src="' + base + 'images/');
        return html;
    }

    function setActiveNav() {
        var page = document.body.getAttribute('data-page') || '';
        if (!page) return;
        document.querySelectorAll('[data-nav="' + page + '"]').forEach(function (el) {
            el.classList.add('nav__link--active');
        });
    }

    /** Inline fallback if icons.svg fails to load */
    function injectSpriteFallback() {
        if (document.getElementById('svg-sprite')) return;
        var wrap = document.createElement('div');
        var symbols = [
            '<symbol id="icon-menu" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></symbol>',
            '<symbol id="icon-close" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></symbol>',
            '<symbol id="icon-sparkle" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 12l-5.2 2.8L12 22l-1.8-5.4L5 12l5.2-2.8L12 2z"/></symbol>',
            '<symbol id="icon-slots" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h4v16H5V4zm5 0h4v16h-4V4zm5 0h4v16h-4V4z"/></symbol>',
            '<symbol id="icon-lanes" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 6.5h3.25v11H4.5v-11zm6.12 2.75h3.25v8.25h-3.25v-8.25zm6.13-.5h3.25v8.75h-3.25V8.75z"/></symbol>',
            '<symbol id="icon-live" viewBox="0 0 24 24" fill="currentColor"><path d="M4 7h11v10H4V7zm13 1.5l5 3.5-5 3.5V8.5z"/></symbol>',
            '<symbol id="icon-sports" viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></symbol>',
            '<symbol id="icon-chart" viewBox="0 0 24 24" fill="currentColor"><path d="M4 19h16v2H4v-2zm2-4h3v4H6v-4zm4-6h3v10h-3V9zm4-4h3v14h-3V5z"/></symbol>',
            '<symbol id="icon-wallet" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7h18v12H3V7zm2 2v8h14V9H5zm11 1h4v6h-4V10z"/></symbol>',
            '<symbol id="icon-globe" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1 18.9A8 8 0 014.1 13H8a12 12 0 002 6.9zM4.1 11A8 8 0 0111 3.1a12 12 0 00-2 6.9H4.1zm2 0h4.8a14 14 0 012.1-7.2A8 8 0 006.1 11zm7.8 0H19a8 8 0 00-6.9-7.2A14 14 0 0113.9 11zm0 2a14 14 0 01-2.1 7.2A8 8 0 0019 13h-5.1z"/></symbol>',
            '<symbol id="icon-shield" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 4v6c0 5-3.4 9.5-8 10-4.6-.5-8-5-8-10V6l8-4z"/></symbol>',
            '<symbol id="icon-gift" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.17A3 3 0 0017 4h-1a3 3 0 00-2.82 2H4v2h16V6zm-7-2a1 1 0 011 1v1h-2V5a1 1 0 011-1zm5 8v10H4V12h14z"/></symbol>',
            '<symbol id="icon-headset" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 00-7 7v4H4v6h3v-6H7V9a5 5 0 0110 0v4h-1v6h3v-6h-1V9a7 7 0 00-7-7z"/></symbol>',
            '<symbol id="icon-check" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></symbol>',
            '<symbol id="icon-arrow-right" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></symbol>',
            '<symbol id="icon-layers" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 4-8 4-8-4 8-4zm0 7l8 4-8 4-8-4 8-4z"/></symbol>',
            '<symbol id="icon-studio" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h7v5H4V6zm9 0h7v12h-7V6zM4 13h7v5H4v-5z"/></symbol>',
            '<symbol id="icon-mobile" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 18a1 1 0 100-2 1 1 0 000 2z"/></symbol>',
            '<symbol id="icon-heart" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></symbol>',
            '<symbol id="icon-book" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h7v16H6a2 2 0 01-2-2V6a2 2 0 012-2zm9 0h5a2 2 0 012 2v14a2 2 0 01-2 2h-5V4z"/></symbol>',
            '<symbol id="icon-clock" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 1C5.93 1 1 5.93 1 12s4.93 11 11 11 11-4.93 11-11S18.07 1 12 1zm0 3c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8 3.58-8 8-8z"/><path d="M13 7h-2v5.59l3.52 2.12 1.03-1.71L13 12.17V7z"/></symbol>',
            '<symbol id="icon-stopwatch" viewBox="0 0 24 24" fill="currentColor"><path d="M11 1h2v2.5h-2V1z"/><path fill-rule="evenodd" d="M12 1C5.93 1 1 5.93 1 12s4.93 11 11 11 11-4.93 11-11S18.07 1 12 1zm0 3c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8 3.58-8 8-8z"/><path d="M13 8.25h-2v4.72l2.95 1.77 1.02-1.69-1.97-1.18V8.25z"/></symbol>',
            '<symbol id="icon-circle-check" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M10.5 14.26L7.24 11l1.41-1.41L10.5 11.44l4.59-4.59L16.41 8.2l-5.91 6.06z"/></symbol>',
            '<symbol id="icon-home" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></symbol>',
            '<symbol id="icon-cards" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z"/></symbol>',
            '<symbol id="icon-promo" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-8 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-8 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm8-16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></symbol>',
            '<symbol id="icon-bank" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10v7h3v-7H4zm6 0v7h4v-7h-4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12h3V5h-3v5zm-9 0h4V5H7v5zm-5 5h19l-9.5-5L2 15z"/></symbol>',
            '<symbol id="icon-badge-check" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 4v6c0 5-3.4 9.5-8 10-4.6-.5-8-5-8-10V6l8-4zm-1.41 12.59L7 11l1.41-1.41 2.18 2.17 5.18-5.18L17 8l-6.41 6.59z"/></symbol>',
            '<symbol id="icon-info" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></symbol>'
        ];
        wrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true" id="svg-sprite"><defs>' +
            symbols.join('') + '</defs></svg>';
        document.body.appendChild(wrap.firstChild);
    }

    function injectSpriteFromFile() {
        if (document.getElementById('svg-sprite')) {
            return Promise.resolve();
        }
        return fetch(base + 'images/icons.svg', {
            credentials: 'same-origin',
            cache: 'no-store'
        })
            .then(function (r) {
                if (!r.ok) throw new Error('icons.svg ' + r.status);
                return r.text();
            })
            .then(function (svgText) {
                var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
                var svgEl = doc.documentElement;
                if (!svgEl || svgEl.querySelector('parsererror')) throw new Error('parse');
                svgEl.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;');
                svgEl.setAttribute('aria-hidden', 'true');
                if (!svgEl.getAttribute('id')) svgEl.setAttribute('id', 'svg-sprite');
                document.body.appendChild(svgEl);
            })
            .catch(function () {
                injectSpriteFallback();
            });
    }

    function run() {
        injectSpriteFromFile()
            .catch(function () {
                injectSpriteFallback();
            })
            .then(function () {
                return Promise.all([
                    fetch(base + 'partials/header.fragment', {
                        credentials: 'same-origin',
                        cache: 'no-store'
                    }).then(function (r) { return r.text(); }),
                    fetch(base + 'partials/footer.fragment', {
                        credentials: 'same-origin',
                        cache: 'no-store'
                    }).then(function (r) { return r.text(); })
                ]);
            })
            .then(function (parts) {
                var headerHtml = rewriteLinks(parts[0]);
                var footerHtml = rewriteLinks(parts[1]);
                var headerPh = document.getElementById('partial-header');
                var footerPh = document.getElementById('partial-footer');
                if (headerPh) {
                    var temp = document.createElement('div');
                    temp.innerHTML = headerHtml;
                    var parent = headerPh.parentNode;
                    while (temp.firstChild) parent.insertBefore(temp.firstChild, headerPh);
                    headerPh.remove();
                }
                if (footerPh) footerPh.outerHTML = footerHtml;
                setActiveNav();

                var main = document.getElementById('main-content');
                if (main) {
                    fetch(base + 'partials/cta-banner.fragment').then(function (r) { return r.text(); }).then(function (html) {
                        var first = main.querySelector('section');
                        if (first) first.insertAdjacentHTML('afterend', rewriteLinks(html));
                        if (typeof window.lf88AttachReveal === 'function') {
                            window.lf88AttachReveal(main);
                        }
                    }).catch(function () {});

                    var explorePartial = document.body.getAttribute('data-explore-partial');
                    if (explorePartial) {
                        fetch(base + 'partials/explore-' + explorePartial + '.fragment').then(function (r) { return r.text(); }).then(function (html) {
                            main.insertAdjacentHTML('beforeend', rewriteLinks(html));
                            if (typeof window.lf88AttachReveal === 'function') {
                                window.lf88AttachReveal(main);
                            }
                        }).catch(function () {});
                    }
                }
            })
            .catch(function () {
                setActiveNav();
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
