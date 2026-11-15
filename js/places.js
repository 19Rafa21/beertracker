// Lógica pura do mapa de bares (sem DOM nem rede): monta a pesquisa ao Overpass
// (OpenStreetMap), interpreta a resposta e calcula distâncias.
// No browser fica em window.BeerPlaces; no Node via require().
(function (root) {
    'use strict';

    const KINDS = {
        pub: { label: 'Pub', icon: '🍺' },
        bar: { label: 'Bar', icon: '🍸' },
        biergarten: { label: 'Esplanada', icon: '🌳' },
        brewery: { label: 'Cervejaria', icon: '🏭' }
    };

    // Acima disto a pesquisa fica pesada demais para o Overpass: pede-se para aproximar.
    const MAX_SPAN_DEGREES = 0.2;

    function round(value) {
        return Math.round(value * 10000) / 10000;
    }

    function isAreaTooLarge(bounds) {
        return (bounds.north - bounds.south) > MAX_SPAN_DEGREES || (bounds.east - bounds.west) > MAX_SPAN_DEGREES;
    }

    // Alarga o retângulo em `ratio` de cada lado (0.25 = mais 25% para cada lado).
    function padBounds(bounds, ratio) {
        const dLat = (bounds.north - bounds.south) * ratio;
        const dLon = (bounds.east - bounds.west) * ratio;
        return {
            south: bounds.south - dLat, north: bounds.north + dLat,
            west: bounds.west - dLon, east: bounds.east + dLon
        };
    }

    function containsBounds(outer, inner) {
        return Boolean(outer && inner) &&
            inner.south >= outer.south && inner.north <= outer.north &&
            inner.west >= outer.west && inner.east <= outer.east;
    }

    // Pubs, bares, esplanadas de cerveja e cervejarias/microcervejarias dentro do retângulo.
    function buildOverpassQuery(bounds, limit) {
        const box = [bounds.south, bounds.west, bounds.north, bounds.east].map(round).join(',');
        return '[out:json][timeout:40];(' +
            'nwr["amenity"~"^(pub|bar|biergarten)$"](' + box + ');' +
            'nwr["craft"="brewery"](' + box + ');' +
            'nwr["microbrewery"="yes"](' + box + ');' +
            ');out center tags ' + (limit || 300) + ';';
    }

    function placeKind(tags) {
        if (tags.craft === 'brewery' || tags.microbrewery === 'yes') {
            return 'brewery';
        }
        if (tags.amenity === 'pub' || tags.amenity === 'bar' || tags.amenity === 'biergarten') {
            return tags.amenity;
        }
        return 'bar';
    }

    function formatAddress(tags) {
        const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
        const place = tags['addr:city'] || tags['addr:suburb'] || tags['addr:place'] || '';
        return [street, place].filter(Boolean).join(', ');
    }

    // Garante que só links http(s) chegam ao HTML.
    function safeUrl(value) {
        const url = String(value || '').trim();
        if (!url) {
            return '';
        }
        if (/^https?:\/\//i.test(url)) {
            return url;
        }
        if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)) {
            return 'https://' + url;
        }
        return '';
    }

    // Converte a resposta do Overpass numa lista de locais com nome, sem repetidos.
    function parsePlaces(data) {
        const elements = (data && Array.isArray(data.elements)) ? data.elements : [];
        const seen = {};
        const places = [];
        elements.forEach(function (el) {
            const tags = el.tags || {};
            const lat = el.lat !== undefined ? el.lat : (el.center && el.center.lat);
            const lon = el.lon !== undefined ? el.lon : (el.center && el.center.lon);
            const name = String(tags.name || '').trim();
            if (!name || typeof lat !== 'number' || typeof lon !== 'number') {
                return;
            }
            const id = el.type + '/' + el.id;
            if (seen[id]) {
                return;
            }
            seen[id] = true;
            places.push({
                id: id,
                name: name,
                kind: placeKind(tags),
                lat: lat,
                lon: lon,
                address: formatAddress(tags),
                hours: String(tags.opening_hours || '').trim(),
                website: safeUrl(tags.website || tags['contact:website']),
                beers: String(tags.brewery || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean),
                outdoor: tags.outdoor_seating === 'yes' || tags.amenity === 'biergarten',
                countryCode: /^[a-z]{2}$/i.test(tags['addr:country'] || '') ? tags['addr:country'].toUpperCase() : ''
            });
        });
        return places;
    }

    // Distância em km entre dois pontos { lat, lon } (fórmula de haversine).
    function distanceKm(a, b) {
        const toRad = function (deg) { return deg * Math.PI / 180; };
        const dLat = toRad(b.lat - a.lat);
        const dLon = toRad(b.lon - a.lon);
        const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    function sortByDistance(places, origin) {
        return places
            .map(function (p) { return Object.assign({}, p, { distance: distanceKm(origin, p) }); })
            .sort(function (a, b) { return a.distance - b.distance || a.name.localeCompare(b.name, 'pt'); });
    }

    // "350 m" ou "1,2 km".
    function formatDistance(km) {
        if (km < 1) {
            return Math.max(10, Math.round(km * 100) * 10) + ' m';
        }
        return (Math.round(km * 10) / 10).toLocaleString('pt-PT') + ' km';
    }

    const DAYS = { Mo: 'Seg', Tu: 'Ter', We: 'Qua', Th: 'Qui', Fr: 'Sex', Sa: 'Sáb', Su: 'Dom', PH: 'Feriados' };

    // Traduz o horário do OpenStreetMap ("Mo-Fr 18:00-02:00; Su off") para português.
    function formatHours(hours) {
        return String(hours || '')
            .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, function (d) { return DAYS[d]; })
            .replace(/\boff\b|\bclosed\b/gi, 'fechado')
            .replace(/24\/7/g, 'Sempre aberto')
            .replace(/\s*;\s*/g, ' · ')
            .trim();
    }

    function filterByKind(places, kind) {
        if (!kind || kind === 'all') {
            return places;
        }
        return places.filter(function (p) { return p.kind === kind; });
    }

    function countByKind(places) {
        const counts = { all: places.length };
        Object.keys(KINDS).forEach(function (k) { counts[k] = 0; });
        places.forEach(function (p) { counts[p.kind] = (counts[p.kind] || 0) + 1; });
        return counts;
    }

    const api = {
        KINDS: KINDS,
        isAreaTooLarge: isAreaTooLarge,
        padBounds: padBounds,
        containsBounds: containsBounds,
        buildOverpassQuery: buildOverpassQuery,
        placeKind: placeKind,
        formatAddress: formatAddress,
        safeUrl: safeUrl,
        parsePlaces: parsePlaces,
        distanceKm: distanceKm,
        sortByDistance: sortByDistance,
        formatDistance: formatDistance,
        formatHours: formatHours,
        filterByKind: filterByKind,
        countByKind: countByKind
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.BeerPlaces = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
