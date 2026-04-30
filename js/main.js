document.addEventListener('DOMContentLoaded', function () {
    document.body.addEventListener('click', function (e) {
        var toggle = e.target.closest('.mobile-menu-toggle');
        if (!toggle) return;
        var menu = document.querySelector('.mobile-menu');
        if (!menu) return;
        menu.classList.toggle('active');
        var use = toggle.querySelector('use');
        if (use) use.setAttribute('href', menu.classList.contains('active') ? '#icon-close' : '#icon-menu');
    });

    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var href = this.getAttribute('href');
            if (href === '#') return;
            var target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                var menu = document.querySelector('.mobile-menu');
                if (menu && menu.classList.contains('active')) {
                    menu.classList.remove('active');
                    var t = document.querySelector('.mobile-menu-toggle use');
                    if (t) t.setAttribute('href', '#icon-menu');
                }
            }
        });
    });

    var header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', function () {
            header.classList.toggle('header--scrolled', window.pageYOffset > 80);
        });
    }

    function attachRevealObserver(scope) {
        var root = scope || document;
        if (!('IntersectionObserver' in window)) {
            root.querySelectorAll('[data-reveal]').forEach(function (el) {
                el.classList.add('is-visible');
            });
            return;
        }
        if (!window._lf88RevealObs) {
            window._lf88RevealObs = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        window._lf88RevealObs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        }
        root.querySelectorAll('[data-reveal]').forEach(function (el) {
            if (!el.classList.contains('is-visible')) {
                window._lf88RevealObs.observe(el);
            }
        });
    }
    attachRevealObserver(document);
    window.lf88AttachReveal = attachRevealObserver;

    /* Desktop: dropdown is CSS hover. Touch / no-hover: toggle LongFu88 Asia menu on tap. */
    document.body.addEventListener('click', function (e) {
        if (!window.matchMedia('(hover: none)').matches) return;
        var btn = e.target.closest('.nav__link--dropdown');
        var item = e.target.closest('.nav__item--dropdown');
        if (btn && item && item.contains(btn)) {
            e.stopPropagation();
            var open = item.classList.toggle('nav__item--dropdown--open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            return;
        }
        if (!item) {
            document.querySelectorAll('.nav__item--dropdown--open').forEach(function (el) {
                el.classList.remove('nav__item--dropdown--open');
                var b = el.querySelector('.nav__link--dropdown');
                if (b) b.setAttribute('aria-expanded', 'false');
            });
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('.nav__item--dropdown--open').forEach(function (el) {
            el.classList.remove('nav__item--dropdown--open');
            var b = el.querySelector('.nav__link--dropdown');
            if (b) b.setAttribute('aria-expanded', 'false');
        });
    });
});
