/**
 * Loads data/catalog-demo.json and renders category shelves (slots / live)
 * or sports demo panels. Illustrative only — no live odds feed.
 */
(function () {
    const HUES = new Set([
        'gold', 'rose', 'sand', 'neon', 'ruby', 'amber', 'jade', 'ocean',
        'crimson', 'azure', 'cherry', 'pink', 'slate', 'wine', 'emerald', 'sunset'
    ]);

    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderProviderStrip(bundle, mount, bundleKey) {
        var list = bundle.topProviders;
        if (!list || !list.length) return;

        var headingId =
            'provider-strip-' +
            String(bundleKey || 'catalog')
                .replace(/[^a-zA-Z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .toLowerCase();
        var section = document.createElement('section');
        section.className = 'provider-strip';
        section.setAttribute('aria-labelledby', headingId);

        var hdr = document.createElement('header');
        hdr.className = 'provider-strip__header';
        var h2 = document.createElement('h2');
        h2.className = 'provider-strip__title';
        h2.id = headingId;
        h2.textContent = bundle.topProvidersTitle || 'Top providers';
        hdr.appendChild(h2);
        if (bundle.topProvidersSubtitle) {
            var sub = document.createElement('p');
            sub.className = 'provider-strip__subtitle';
            sub.textContent = bundle.topProvidersSubtitle;
            hdr.appendChild(sub);
        }
        section.appendChild(hdr);

        var ul = document.createElement('ul');
        ul.className = 'provider-strip__list';

        list.forEach(function (pr) {
            var logoSrc = pr.logo || 'images/providers/' + (pr.id || 'unknown') + '.svg';
            var li = document.createElement('li');
            var figure = document.createElement('figure');
            figure.className = 'provider-card';
            var img = document.createElement('img');
            img.src = logoSrc;
            img.alt = pr.name ? pr.name + ' (illustrative mark)' : '';
            img.width = 176;
            img.height = 48;
            img.loading = 'lazy';
            img.decoding = 'async';
            figure.appendChild(img);
            li.appendChild(figure);
            ul.appendChild(li);
        });

        section.appendChild(ul);
        mount.appendChild(section);
    }

    function renderGameShelves(mount, bundleKey, data) {
        const bundle = data[bundleKey];
        const shelves = bundle && bundle.shelves ? bundle.shelves : [];
        const note = document.createElement('p');
        note.className = 'catalog-disclaimer';
        note.textContent = data.updatedNote || '';
        mount.appendChild(note);

        renderProviderStrip(bundle, mount, bundleKey);

        shelves.forEach(function (shelf) {
            const sid = 'shelf-' + String(shelf.id || 'row').replace(/[^a-z0-9-]/gi, '-');
            const wrap = document.createElement('section');
            wrap.className = 'game-shelf';
            wrap.setAttribute('aria-labelledby', sid);

            const header = document.createElement('header');
            header.className = 'game-shelf__header';
            const h2 = document.createElement('h2');
            h2.className = 'game-shelf__title';
            h2.id = sid;
            h2.textContent = shelf.title || '';
            const sub = document.createElement('p');
            sub.className = 'game-shelf__subtitle';
            sub.textContent = shelf.subtitle || '';
            header.appendChild(h2);
            header.appendChild(sub);

            const track = document.createElement('div');
            track.className = 'game-shelf__track';
            track.setAttribute('role', 'list');

            (shelf.games || []).forEach(function (g) {
                const hue = g.hue && HUES.has(g.hue) ? g.hue : 'gold';
                const art = document.createElement('div');
                art.className = 'game-tile__media game-tile__media--hue-' + hue;
                art.setAttribute('aria-hidden', 'true');

                const body = document.createElement('div');
                body.className = 'game-tile__body';

                const tag = document.createElement('span');
                tag.className = 'game-tile__tag';
                tag.textContent = g.tag || '';

                const name = document.createElement('h3');
                name.className = 'game-tile__name';
                name.textContent = g.name || '';

                const meta = document.createElement('p');
                meta.className = 'game-tile__meta';
                meta.textContent = [g.provider, g.hint].filter(Boolean).join(' · ');

                body.appendChild(tag);
                body.appendChild(name);
                body.appendChild(meta);

                const tile = document.createElement('article');
                tile.className = 'game-tile';
                tile.setAttribute('role', 'listitem');
                tile.appendChild(art);
                tile.appendChild(body);
                track.appendChild(tile);
            });

            wrap.appendChild(header);
            wrap.appendChild(track);
            mount.appendChild(wrap);
        });
    }

    function renderSports(mount, data) {
        const sp = data.sports || {};
        const disclaimer = document.createElement('div');
        disclaimer.className = 'catalog-disclaimer catalog-disclaimer--box';
        disclaimer.innerHTML =
            '<p>' +
            esc(data.updatedNote) +
            '</p><p><strong>Demo data only:</strong> teams, kick-offs, odds, and scores below are fictional examples for practising how slips look — always verify markets on LongFu88. <strong>18+ only.</strong> We do not publish betting tips.</p>';
        mount.appendChild(disclaimer);

        const hTypes = document.createElement('h2');
        hTypes.className = 'catalog-section-title';
        hTypes.textContent = 'Popular sports types';
        mount.appendChild(hTypes);

        const typeGrid = document.createElement('div');
        typeGrid.className = 'sport-type-grid';
        (sp.popularTypes || []).forEach(function (t) {
            const card = document.createElement('article');
            card.className = 'sport-type-card';
            const abbr = document.createElement('span');
            abbr.className = 'sport-type-card__abbr';
            abbr.textContent = t.abbr || '';
            const nm = document.createElement('h3');
            nm.className = 'sport-type-card__name';
            nm.textContent = t.name || '';
            const note = document.createElement('p');
            note.className = 'sport-type-card__note';
            note.textContent = t.note || '';
            card.appendChild(abbr);
            card.appendChild(nm);
            card.appendChild(note);
            typeGrid.appendChild(card);
        });
        mount.appendChild(typeGrid);

        const hLeagues = document.createElement('h2');
        hLeagues.className = 'catalog-section-title';
        hLeagues.textContent = 'Leagues players watch most';
        mount.appendChild(hLeagues);

        const leagueGrid = document.createElement('div');
        leagueGrid.className = 'league-card-grid';
        (sp.topLeagues || []).forEach(function (L) {
            const card = document.createElement('article');
            card.className = 'league-card';
            const reg = document.createElement('span');
            reg.className = 'league-card__region';
            reg.textContent = L.region || '';
            const nm = document.createElement('h3');
            nm.className = 'league-card__name';
            nm.textContent = L.name || '';
            const hook = document.createElement('p');
            hook.className = 'league-card__hook';
            const bits = [L.hook, L.note].filter(Boolean);
            hook.textContent = bits.join(' ');
            card.appendChild(reg);
            card.appendChild(nm);
            card.appendChild(hook);
            leagueGrid.appendChild(card);
        });
        mount.appendChild(leagueGrid);

        const hUp = document.createElement('h2');
        hUp.className = 'catalog-section-title';
        hUp.textContent = 'Upcoming fixtures (illustrative odds)';
        mount.appendChild(hUp);

        const capUp = document.createElement('p');
        capUp.className = 'catalog-table-caption';
        capUp.textContent =
            'Decimal prices show format only; implied probabilities ignore bookmaker margin.';
        mount.appendChild(capUp);

        const wrapTbl = document.createElement('div');
        wrapTbl.className = 'data-table-wrap';
        const tbl = document.createElement('table');
        tbl.className = 'data-table data-table--compact';
        tbl.innerHTML =
            '<thead><tr>' +
            '<th>Kick-off</th><th>Fixture</th><th>League</th>' +
            '<th>Demo 1X2</th><th>AH example</th><th>How to read this row</th>' +
            '</tr></thead><tbody></tbody>';
        const tb = tbl.querySelector('tbody');
        (sp.upcoming || []).forEach(function (row) {
            const o = row.odds1x2 || {};
            const tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' +
                esc(row.kickoff) +
                '</td><td><strong>' +
                esc(row.home) +
                '</strong> vs <strong>' +
                esc(row.away) +
                '</strong></td><td>' +
                esc(row.league) +
                '</td><td><span class="odds-demo-row">' +
                '<span class="odds-pill">1 ' +
                esc(o.home) +
                '</span>' +
                '<span class="odds-pill">X ' +
                esc(o.draw) +
                '</span>' +
                '<span class="odds-pill">2 ' +
                esc(o.away) +
                '</span></span></td><td>' +
                esc(row.handicapDemo) +
                '</td><td>' +
                esc(row.read) +
                '</td>';
            tb.appendChild(tr);
        });
        wrapTbl.appendChild(tbl);
        mount.appendChild(wrapTbl);

        const hRes = document.createElement('h2');
        hRes.className = 'catalog-section-title';
        hRes.textContent = 'Recent results (demo narrative)';
        mount.appendChild(hRes);

        const capRes = document.createElement('p');
        capRes.className = 'catalog-table-caption';
        capRes.textContent = 'Sample scorelines explain how results tie back to spreads — not news.';
        mount.appendChild(capRes);

        const wrapRes = document.createElement('div');
        wrapRes.className = 'data-table-wrap';
        const tbl2 = document.createElement('table');
        tbl2.className = 'data-table data-table--compact';
        tbl2.innerHTML =
            '<thead><tr><th>League</th><th>Result</th><th>Note</th></tr></thead><tbody></tbody>';
        const tb2 = tbl2.querySelector('tbody');
        (sp.recentResults || []).forEach(function (row) {
            const tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' +
                esc(row.league) +
                '</td><td>' +
                esc(row.fixture) +
                '</td><td>' +
                esc(row.note) +
                '</td>';
            tb2.appendChild(tr);
        });
        wrapRes.appendChild(tbl2);
        mount.appendChild(wrapRes);
    }

    function init() {
        var page = document.body.getAttribute('data-page');
        var map = {
            slots: 'catalog-mount-slots',
            'live-casino': 'catalog-mount-live',
            'sports-betting': 'catalog-mount-sports',
            promotions: 'catalog-mount-promotions'
        };
        var id = map[page];
        if (!id) return;
        var mount = document.getElementById(id);
        if (!mount) return;

        fetch('data/catalog-demo.json', { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) throw new Error('bad status');
                return r.json();
            })
            .then(function (data) {
                mount.innerHTML = '';
                if (page === 'slots') renderGameShelves(mount, 'slots', data);
                else if (page === 'live-casino') renderGameShelves(mount, 'liveCasino', data);
                else if (page === 'promotions') renderGameShelves(mount, 'promotions', data);
                else if (page === 'sports-betting') renderSports(mount, data);
            })
            .catch(function () {
                mount.innerHTML =
                    '<p class="catalog-error" role="alert">Could not load the demo catalogue. Check your connection or redeploy with <code>data/catalog-demo.json</code>.</p>';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
