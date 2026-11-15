// Página do mapa: bares, pubs e cervejarias do OpenStreetMap.
// O Leaflet só é carregado quando a página é aberta pela primeira vez.
// A lógica sem DOM (pesquisa, interpretação, distâncias) está em js/places.js.
(function () {
    'use strict';

    const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    // Servidores públicos do Overpass, experimentados por esta ordem.
    const OVERPASS_URLS = [
        'https://overpass-api.de/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        'https://overpass.private.coffee/api/interpreter'
    ];
    const ATTEMPT_TIMEOUT = 35000;
    const CACHE_KEY = 'placesCache';
    const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
    const VIEW_KEY = 'mapView';
    // Bairro Alto / Cais do Sodré, em Lisboa.
    const DEFAULT_VIEW = { lat: 38.7105, lon: -9.1435, zoom: 15 };

    const P = window.BeerPlaces;
    // Ícone (do conjunto em index.html) de cada tipo de local.
    const KIND_ICONS = { pub: 'beer', bar: 'martini', brewery: 'factory', biergarten: 'trees' };

    function icon(name) {
        return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
    }
    const $ = function (id) { return document.getElementById(id); };

    const state = {
        map: null,
        loading: null,
        markers: {},
        places: [],
        kind: 'all',
        userPos: null,
        userMarker: null,
        lastSearch: null,
        request: null,
        note: ''
    };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function setStatus(text) {
        $('map-status').textContent = text;
    }

    // ---------- Carregar o Leaflet ----------

    function loadLeaflet() {
        if (window.L) {
            return Promise.resolve();
        }
        if (state.loading) {
            return state.loading;
        }
        state.loading = new Promise(function (resolve, reject) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = LEAFLET_CSS;
            document.head.appendChild(css);

            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.onload = function () { resolve(); };
            script.onerror = function () {
                state.loading = null;
                script.remove();
                reject(new Error('leaflet'));
            };
            document.head.appendChild(script);
        });
        return state.loading;
    }

    function savedView() {
        try {
            const view = JSON.parse(localStorage.getItem(VIEW_KEY));
            if (view && isFinite(view.lat) && isFinite(view.lon) && isFinite(view.zoom)) {
                return view;
            }
        } catch (e) { /* sem armazenamento ou valor inválido */ }
        return DEFAULT_VIEW;
    }

    function saveView() {
        const c = state.map.getCenter();
        try {
            localStorage.setItem(VIEW_KEY, JSON.stringify({ lat: c.lat, lon: c.lng, zoom: state.map.getZoom() }));
        } catch (e) { /* sem armazenamento */ }
    }

    function initMap() {
        const view = savedView();
        state.map = L.map('map', { zoomControl: true }).setView([view.lat, view.lon], view.zoom);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(state.map);

        state.map.on('moveend', function () {
            saveView();
            $('search-area').classList.toggle('hidden', !movedSinceSearch());
        });
        searchArea();
    }

    // Mostra "Procurar nesta zona" quando o mapa saiu da área já pesquisada.
    function movedSinceSearch() {
        return !P.containsBounds(state.lastSearch, currentBounds());
    }

    // ---------- Pesquisa de locais ----------

    function currentBounds() {
        const b = state.map.getBounds();
        return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
    }

    // Última zona pesquisada, para o mapa abrir logo com resultados (válida 1 dia).
    function readCache() {
        try {
            const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (cache && cache.bounds && Array.isArray(cache.places) && Date.now() - cache.at < CACHE_MAX_AGE) {
                return cache;
            }
        } catch (e) { /* sem armazenamento ou valor inválido */ }
        return null;
    }

    function writeCache(bounds, places) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ bounds: bounds, places: places, at: Date.now() }));
        } catch (e) { /* sem armazenamento */ }
    }

    // Pede a um servidor Overpass; se estiver ocupado ou demorar demais, passa ao seguinte.
    function fetchFromServers(query, signal) {
        let attempt = 0;
        function next(lastError) {
            if (signal.aborted) {
                return Promise.reject(new DOMException('Cancelado', 'AbortError'));
            }
            if (attempt >= OVERPASS_URLS.length) {
                return Promise.reject(lastError || new Error('busy'));
            }
            const url = OVERPASS_URLS[attempt++];
            const timeout = new AbortController();
            const timer = setTimeout(function () { timeout.abort(); }, ATTEMPT_TIMEOUT);
            const onAbort = function () { timeout.abort(); };
            signal.addEventListener('abort', onAbort);
            return fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'data=' + encodeURIComponent(query),
                signal: timeout.signal
            })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('busy');
                    }
                    return response.json();
                })
                .catch(function (error) {
                    if (signal.aborted) {
                        throw error;
                    }
                    setStatus('O servidor de mapas está lento; a tentar outro…');
                    return next(error);
                })
                .finally(function () {
                    clearTimeout(timer);
                    signal.removeEventListener('abort', onAbort);
                });
        }
        return next();
    }

    function searchArea() {
        const view = currentBounds();
        $('search-area').classList.add('hidden');

        if (P.isAreaTooLarge(view)) {
            state.lastSearch = null;
            setStatus('Aproxime o mapa para procurar bares nesta zona.');
            state.places = [];
            showPlaces([]);
            $('search-area').classList.remove('hidden');
            return;
        }

        const cache = readCache();
        if (cache && P.containsBounds(cache.bounds, view)) {
            state.lastSearch = cache.bounds;
            state.places = cache.places;
            showPlaces(state.places);
            return;
        }

        // Procura com margem à volta, para pequenos movimentos não obrigarem a nova pesquisa.
        const bounds = P.padBounds(view, 0.25);
        if (state.request) {
            state.request.abort();
        }
        const controller = new AbortController();
        state.request = controller;
        state.note = 'a carregar mais…';
        state.places = [];
        showPlaces([]);
        $('place-list').setAttribute('aria-busy', 'true');
        setStatus('A procurar bares…');

        let quick = [];
        let full = null;

        // 1) Primeira vista rápida (Nominatim): pubs e bares mais conhecidos da zona visível.
        fetchQuickPlaces(view, controller.signal).then(function (places) {
            if (controller.signal.aborted || full) {
                return;
            }
            quick = places;
            if (quick.length) {
                state.places = quick;
                showPlaces(quick);
            }
        });

        // 2) Lista completa (Overpass): cervejarias, horários e todos os locais da zona.
        fetchFromServers(P.buildOverpassQuery(bounds, 400), controller.signal)
            .then(function (data) {
                full = P.mergePlaces(P.parsePlaces(data), quick);
                state.note = '';
                state.lastSearch = bounds;
                state.places = full;
                writeCache(bounds, full);
                showPlaces(full);
            })
            .catch(function (error) {
                if (controller.signal.aborted) {
                    return;
                }
                if (quick.length) {
                    // Fica com a primeira vista; o resto pode ser pedido outra vez.
                    state.note = 'lista parcial: os servidores do OpenStreetMap estão ocupados';
                    state.lastSearch = view;
                    showPlaces(state.places);
                } else {
                    state.note = '';
                    setStatus(navigator.onLine === false
                        ? 'Sem ligação. Verifique a internet e tente outra vez.'
                        : 'Os servidores de mapas estão ocupados. Tente daqui a pouco.');
                }
                $('search-area').classList.remove('hidden');
            })
            .finally(function () {
                if (state.request === controller) {
                    state.request = null;
                    $('place-list').removeAttribute('aria-busy');
                }
            });
    }

    // Pedidos ao Nominatim espaçados de 1,1 s (regra de utilização do serviço).
    // Pedidos de pesquisas já canceladas saem da fila sem esperar.
    let nominatimQueue = Promise.resolve();
    let lastNominatimAt = 0;
    function nominatimFetch(url, signal) {
        const run = nominatimQueue.then(function () {
            if (signal && signal.aborted) {
                throw new DOMException('Cancelado', 'AbortError');
            }
            const wait = Math.max(0, lastNominatimAt + 1100 - Date.now());
            return new Promise(function (resolve) { setTimeout(resolve, wait); }).then(function () {
                if (signal && signal.aborted) {
                    throw new DOMException('Cancelado', 'AbortError');
                }
                lastNominatimAt = Date.now();
                return fetch(url, { signal: signal });
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error('nominatim ' + response.status);
                }
                return response.json();
            });
        });
        nominatimQueue = run.catch(function () {});
        return run;
    }

    function fetchQuickPlaces(view, signal) {
        const box = [view.west, view.north, view.east, view.south].map(function (n) { return n.toFixed(5); }).join(',');
        const base = NOMINATIM_URL + '?format=jsonv2&limit=40&bounded=1&addressdetails=1&extratags=1&accept-language=pt-PT&viewbox=' + box + '&amenity=';
        const requests = ['pub', 'bar', 'biergarten'].map(function (kind) {
            return nominatimFetch(base + kind, signal)
                .then(P.parseNominatimPlaces)
                .catch(function () { return []; });
        });
        return Promise.all(requests).then(function (lists) {
            return lists.reduce(function (all, list) { return P.mergePlaces(all, list); }, []);
        });
    }

    // ---------- Mostrar resultados ----------

    function referencePoint() {
        if (state.userPos && state.map.getBounds().contains([state.userPos.lat, state.userPos.lon])) {
            return state.userPos;
        }
        const c = state.map.getCenter();
        return { lat: c.lat, lon: c.lng };
    }

    function pinIcon(kind) {
        return L.divIcon({
            className: 'place-pin place-pin-' + kind,
            html: '<span>' + icon(KIND_ICONS[kind]) + '</span>',
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -32]
        });
    }

    function popupHtml(place) {
        const kind = P.KINDS[place.kind];
        const rows = [];
        if (place.address) {
            rows.push('<p class="popup-line">' + icon('pin') + escapeHtml(place.address) + '</p>');
        }
        if (place.hours) {
            rows.push('<p class="popup-line">' + icon('clock') + escapeHtml(P.formatHours(place.hours)) + '</p>');
        }
        if (place.beers.length) {
            rows.push('<p class="popup-line">' + icon('beer') + escapeHtml(place.beers.join(', ')) + '</p>');
        }
        const links = [
            '<a href="https://www.google.com/maps/dir/?api=1&amp;destination=' + place.lat + ',' + place.lon + '" target="_blank" rel="noopener">' + icon('route') + 'Como chegar</a>',
            place.website ? '<a href="' + escapeHtml(place.website) + '" target="_blank" rel="noopener">' + icon('external') + 'Site</a>' : '',
            '<a href="https://www.openstreetmap.org/' + escapeHtml(place.id) + '" target="_blank" rel="noopener">OpenStreetMap</a>'
        ].filter(Boolean).join('');
        return '<div class="place-popup">' +
            '<p class="popup-kind place-pin-' + place.kind + '">' + icon(KIND_ICONS[place.kind]) + escapeHtml(kind.label) + (place.outdoor && place.kind !== 'biergarten' ? ' · esplanada' : '') + '</p>' +
            '<h3>' + escapeHtml(place.name) + '</h3>' +
            rows.join('') +
            '<div class="popup-links">' + links + '</div>' +
            '<button type="button" class="btn btn-primary btn-small popup-register" data-place="' + escapeHtml(place.id) + '">Registar uma cerveja aqui</button>' +
            '</div>';
    }

    function updateChips(places) {
        const counts = P.countByKind(places);
        document.querySelectorAll('#kind-filters .chip').forEach(function (chip) {
            const kind = chip.dataset.kind;
            chip.setAttribute('aria-pressed', kind === state.kind ? 'true' : 'false');
            chip.querySelector('.chip-count').textContent = counts[kind] || 0;
            chip.disabled = kind !== 'all' && !counts[kind];
        });
    }

    function showPlaces(places) {
        Object.keys(state.markers).forEach(function (id) { state.markers[id].remove(); });
        state.markers = {};

        // Se o filtro escolhido deixou de ter resultados, volta a "Todos".
        if (state.kind !== 'all' && !P.filterByKind(places, state.kind).length) {
            state.kind = 'all';
        }
        updateChips(places);

        const visible = P.sortByDistance(P.filterByKind(places, state.kind), referencePoint());
        visible.forEach(function (place) {
            const marker = L.marker([place.lat, place.lon], { icon: pinIcon(place.kind), title: place.name, riseOnHover: true })
                .bindPopup(popupHtml(place), { maxWidth: 280 })
                .addTo(state.map);
            state.markers[place.id] = marker;
        });

        const fromYou = state.userPos && referencePoint() === state.userPos;
        $('place-list').innerHTML = visible.map(function (place) {
            const kind = P.KINDS[place.kind];
            return '<li><button type="button" class="place-item" data-place="' + escapeHtml(place.id) + '">' +
                '<span class="place-icon place-pin-' + place.kind + '">' + icon(KIND_ICONS[place.kind]) + '</span>' +
                '<span class="place-main">' +
                    '<span class="place-name">' + escapeHtml(place.name) + '</span>' +
                    '<span class="place-meta">' + escapeHtml([kind.label, place.address].filter(Boolean).join(' · ')) + '</span>' +
                '</span>' +
                '<span class="place-distance">' + escapeHtml(P.formatDistance(place.distance)) + '</span>' +
                '</button></li>';
        }).join('');

        if (!state.lastSearch && !state.note) {
            return;
        }
        if (!places.length) {
            setStatus('Nenhum bar encontrado aqui. Afaste o mapa ou procure outra zona.');
        } else {
            setStatus(visible.length + (visible.length === 1 ? ' local' : ' locais') +
                (fromYou ? ', do mais perto de si' : ', do mais perto do centro do mapa') +
                (state.note ? ' · ' + state.note : ''));
        }
    }

    function findPlace(id) {
        return state.places.find(function (p) { return p.id === id; });
    }

    function focusPlace(id) {
        const marker = state.markers[id];
        if (!marker) {
            return;
        }
        state.map.setView(marker.getLatLng(), Math.max(state.map.getZoom(), 17), { animate: true });
        marker.openPopup();
        if (window.matchMedia('(max-width: 960px)').matches) {
            $('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // ---------- Localização e pesquisa de sítios ----------

    function locate() {
        if (!navigator.geolocation) {
            setStatus('Este browser não permite saber a sua localização.');
            return;
        }
        setStatus('A obter a sua localização…');
        navigator.geolocation.getCurrentPosition(function (pos) {
            state.userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            if (state.userMarker) {
                state.userMarker.remove();
            }
            state.userMarker = L.circleMarker([state.userPos.lat, state.userPos.lon], {
                radius: 8, color: '#fff', weight: 3, fillColor: '#1d6fd6', fillOpacity: 1
            }).bindTooltip('Está aqui').addTo(state.map);
            state.map.setView([state.userPos.lat, state.userPos.lon], 15);
            searchArea();
        }, function (error) {
            setStatus(error.code === 1
                ? 'Sem autorização para usar a localização. Pode procurar por cidade ou bairro.'
                : 'Não foi possível obter a sua localização.');
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    }

    function searchPlace(query) {
        const q = query.trim();
        if (!q) {
            return;
        }
        setStatus('A procurar "' + q + '"…');
        const url = NOMINATIM_URL + '?format=jsonv2&limit=1&accept-language=pt&q=' + encodeURIComponent(q);
        nominatimFetch(url)
            .then(function (results) {
                if (!results.length) {
                    setStatus('Não encontrei "' + q + '". Experimente outro nome.');
                    return;
                }
                const r = results[0];
                const bb = r.boundingbox.map(Number); // [sul, norte, oeste, este]
                const box = { south: bb[0], north: bb[1], west: bb[2], east: bb[3] };
                // Escala de bairro: cidades inteiras são grandes demais e uma rua é pequena demais.
                if (P.isAreaTooLarge(box)) {
                    state.map.setView([Number(r.lat), Number(r.lon)], 15);
                } else {
                    state.map.fitBounds([[box.south, box.west], [box.north, box.east]], { maxZoom: 15 });
                }
                searchArea();
            })
            .catch(function () {
                setStatus('Não foi possível procurar esse sítio. Verifique a ligação.');
            });
    }

    // País do local (para o campo "País onde a bebeu"). Usa o Nominatim; se falhar
    // ou demorar mais de 3 s, segue sem país.
    function countryOf(place) {
        const url = NOMINATIM_URL.replace('/search', '/reverse') + '?format=jsonv2&zoom=3&accept-language=pt-PT' +
            '&lat=' + encodeURIComponent(place.lat) + '&lon=' + encodeURIComponent(place.lon);
        const lookup = fetch(url)
            .then(function (response) { return response.ok ? response.json() : {}; })
            .then(function (data) { return (data.address && data.address.country) || ''; })
            .catch(function () { return ''; });
        const timeout = new Promise(function (resolve) { setTimeout(function () { resolve(''); }, 3000); });
        return Promise.race([lookup, timeout]);
    }

    // ---------- Arranque ----------

    function bindEvents() {
        $('search-area').addEventListener('click', searchArea);
        $('locate-button').addEventListener('click', function () {
            show().then(locate).catch(function () { /* aviso já mostrado */ });
        });
        $('place-search').addEventListener('submit', function (event) {
            event.preventDefault();
            const query = $('place-query').value;
            show().then(function () { searchPlace(query); }).catch(function () { /* aviso já mostrado */ });
        });
        $('kind-filters').addEventListener('click', function (event) {
            const chip = event.target.closest('.chip');
            if (!chip || chip.disabled) {
                return;
            }
            state.kind = chip.dataset.kind;
            showPlaces(state.places);
        });
        $('place-list').addEventListener('click', function (event) {
            const item = event.target.closest('.place-item');
            if (item) {
                focusPlace(item.dataset.place);
            }
        });
        // O botão "Registar uma cerveja aqui" está dentro do popup do Leaflet.
        $('map').addEventListener('click', function (event) {
            const button = event.target.closest('.popup-register');
            const place = button && findPlace(button.dataset.place);
            if (place) {
                button.disabled = true;
                countryOf(place).then(function (country) {
                    button.disabled = false;
                    window.dispatchEvent(new CustomEvent('beertracker:register-at', {
                        detail: Object.assign({}, place, { country: country })
                    }));
                });
            }
        });
    }

    // Chamado pela app sempre que a página do mapa fica visível.
    function show() {
        return loadLeaflet()
            .then(function () {
                $('map-unavailable').classList.add('hidden');
                if (!state.map) {
                    initMap();
                } else {
                    state.map.invalidateSize();
                }
            })
            .catch(function () {
                $('map-unavailable').classList.remove('hidden');
                setStatus('');
                return Promise.reject(new Error('mapa indisponível'));
            });
    }

    bindEvents();
    window.BeerMap = {
        show: function () { show().catch(function () { /* aviso já mostrado */ }); }
    };
})();
