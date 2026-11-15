const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/places.js');

const LISBOA = { south: 38.70, west: -9.16, north: 38.72, east: -9.13 };

test('buildOverpassQuery inclui pubs, bares, esplanadas e cervejarias na área', () => {
    const q = P.buildOverpassQuery({ south: 38.700001, west: -9.16, north: 38.72, east: -9.13 }, 50);
    assert.match(q, /^\[out:json\]/);
    assert.match(q, /amenity"~"\^\(pub\|bar\|biergarten\)\$"\]\(38\.7,-9\.16,38\.72,-9\.13\)/);
    assert.match(q, /craft"="brewery"/);
    assert.match(q, /out center tags 50;$/);
});

test('isAreaTooLarge trava áreas grandes', () => {
    assert.equal(P.isAreaTooLarge(LISBOA), false);
    assert.equal(P.isAreaTooLarge({ south: 37, west: -10, north: 42, east: -6 }), true);
});

test('parsePlaces lê nós e edifícios, ignora sem nome e repetidos', () => {
    const data = {
        elements: [
            { type: 'node', id: 1, lat: 38.71, lon: -9.14, tags: { amenity: 'pub', name: 'O Pub', 'addr:street': 'Rua Augusta', 'addr:housenumber': '10', 'addr:city': 'Lisboa', 'addr:country': 'pt', opening_hours: 'Mo-Su 18:00-02:00', brewery: 'Guinness;Super Bock', website: 'opub.pt' } },
            { type: 'way', id: 2, center: { lat: 38.705, lon: -9.15 }, tags: { craft: 'brewery', amenity: 'bar', name: 'Fábrica', website: 'javascript:alert(1)' } },
            { type: 'node', id: 3, lat: 38.7, lon: -9.1, tags: { amenity: 'bar' } },
            { type: 'node', id: 1, lat: 38.71, lon: -9.14, tags: { amenity: 'pub', name: 'O Pub' } },
            { type: 'node', id: 4, lat: 38.72, lon: -9.12, tags: { amenity: 'biergarten', name: 'Jardim' } }
        ]
    };
    const places = P.parsePlaces(data);
    assert.equal(places.length, 3);
    assert.deepEqual(places[0], {
        id: 'node/1', name: 'O Pub', kind: 'pub', lat: 38.71, lon: -9.14,
        address: 'Rua Augusta 10, Lisboa', hours: 'Mo-Su 18:00-02:00',
        website: 'https://opub.pt', beers: ['Guinness', 'Super Bock'], outdoor: false, countryCode: 'PT'
    });
    assert.equal(places[1].kind, 'brewery');
    assert.equal(places[1].lat, 38.705);
    assert.equal(places[1].website, '');
    assert.equal(places[2].outdoor, true);
    assert.deepEqual(P.parsePlaces(null), []);
});

test('distâncias: cálculo, ordenação e formato', () => {
    const lisboa = { lat: 38.7223, lon: -9.1393 };
    const porto = { lat: 41.1579, lon: -8.6291 };
    const d = P.distanceKm(lisboa, porto);
    assert.ok(d > 270 && d < 280, String(d));

    const sorted = P.sortByDistance([
        { name: 'Longe', lat: 38.8, lon: -9.1 },
        { name: 'Perto', lat: 38.7224, lon: -9.1394 }
    ], lisboa);
    assert.equal(sorted[0].name, 'Perto');
    assert.ok(sorted[0].distance < 0.05);

    assert.equal(P.formatDistance(0.004), '10 m');
    assert.equal(P.formatDistance(0.347), '350 m');
    assert.equal(P.formatDistance(1.24), '1,2 km');
});

test('filtrar e contar por tipo de local', () => {
    const places = [{ kind: 'pub' }, { kind: 'bar' }, { kind: 'pub' }];
    assert.equal(P.filterByKind(places, 'pub').length, 2);
    assert.equal(P.filterByKind(places, 'all').length, 3);
    assert.deepEqual(P.countByKind(places), { all: 3, pub: 2, bar: 1, biergarten: 0, brewery: 0 });
});

test('formatHours traduz dias e fechos', () => {
    assert.equal(P.formatHours('Mo-Fr 18:00-02:00; Sa,Su 16:00-03:00; PH off'), 'Seg-Sex 18:00-02:00 · Sáb,Dom 16:00-03:00 · Feriados fechado');
    assert.equal(P.formatHours('24/7'), 'Sempre aberto');
    assert.equal(P.formatHours(''), '');
});

test('padBounds alarga a área e containsBounds verifica se uma cabe na outra', () => {
    const padded = P.padBounds({ south: 0, north: 1, west: 10, east: 12 }, 0.25);
    assert.deepEqual(padded, { south: -0.25, north: 1.25, west: 9.5, east: 12.5 });
    assert.equal(P.containsBounds(padded, { south: 0, north: 1, west: 10, east: 12 }), true);
    assert.equal(P.containsBounds(padded, { south: -1, north: 1, west: 10, east: 12 }), false);
    assert.equal(P.containsBounds(null, padded), false);
});

test('parseNominatimPlaces lê pubs e bares do Nominatim', () => {
    const list = [
        { osm_type: 'node', osm_id: 1, lat: '41.14', lon: '-8.61', name: 'Honey Bee', type: 'pub',
          address: { road: 'Rua de Trás', house_number: '11', city: 'Porto', country_code: 'pt' },
          extratags: { opening_hours: 'Mo-Su 17:00-02:00', website: 'honeybee.pt' } },
        { osm_type: 'way', osm_id: 2, lat: '41.15', lon: '-8.60', name: 'Café', type: 'cafe' },
        { osm_type: 'node', osm_id: 3, lat: '41.15', lon: '-8.60', name: '', type: 'bar' },
        { osm_type: 'node', osm_id: 1, lat: '41.14', lon: '-8.61', name: 'Honey Bee', type: 'pub' }
    ];
    const places = P.parseNominatimPlaces(list);
    assert.equal(places.length, 1);
    assert.deepEqual(places[0], {
        id: 'node/1', name: 'Honey Bee', kind: 'pub', lat: 41.14, lon: -8.61,
        address: 'Rua de Trás 11, Porto', hours: 'Mo-Su 17:00-02:00', website: 'https://honeybee.pt',
        beers: [], outdoor: false, countryCode: 'PT'
    });
    assert.deepEqual(P.parseNominatimPlaces(null), []);
});

test('mergePlaces prefere a lista principal e junta o resto', () => {
    const overpass = [{ id: 'node/1', name: 'A', address: '', countryCode: '' }];
    const quick = [
        { id: 'node/1', name: 'A (rápido)', address: 'Rua X', countryCode: 'PT' },
        { id: 'node/2', name: 'B', address: '', countryCode: 'PT' }
    ];
    const merged = P.mergePlaces(overpass, quick);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].name, 'A');
    assert.equal(merged[0].address, 'Rua X');
    assert.equal(merged[0].countryCode, 'PT');
    assert.equal(overpass[0].address, '');
});
