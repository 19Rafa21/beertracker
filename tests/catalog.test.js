const test = require('node:test');
const assert = require('node:assert/strict');
const { CATALOG, buildSuggestions, searchCatalog, findByName, normalize } = require('../js/catalog.js');
const { validateBeer } = require('../js/stats.js');

const FORM_TYPES = ['Lager', 'Pilsner', 'IPA', 'Pale Ale', 'Ale', 'Stout', 'Porter', 'Weiss', 'Sour', 'Outro'];

test('todas as entradas do catálogo são válidas e usam os tipos do formulário', () => {
    assert.ok(CATALOG.length >= 100);
    const names = new Set();
    CATALOG.forEach((entry) => {
        assert.ok(FORM_TYPES.includes(entry.type), entry.name + ': tipo ' + entry.type);
        assert.ok(entry.origin, entry.name + ': sem país de origem');
        const result = validateBeer({ ...entry, country: entry.origin, rating: 3, date: '2025-01-01' });
        assert.deepEqual(result.errors, {}, entry.name);
        const key = normalize(entry.name);
        assert.ok(!names.has(key), 'nome repetido: ' + entry.name);
        names.add(key);
    });
});

test('searchCatalog ignora acentos e põe primeiro os nomes que começam pela pesquisa', () => {
    const results = searchCatalog(CATALOG, 'lowenbrau');
    assert.equal(results[0].name, 'Löwenbräu Original');

    const sagres = searchCatalog(CATALOG, 'sag');
    assert.ok(sagres.length >= 3);
    sagres.forEach((e) => assert.match(e.name, /^Sagres/));
});

test('searchCatalog exige todas as palavras e procura também na marca', () => {
    const results = searchCatalog(CATALOG, 'brewdog ipa');
    assert.ok(results.length >= 1);
    results.forEach((e) => assert.equal(e.brand, 'BrewDog'));
    assert.deepEqual(searchCatalog(CATALOG, '   '), []);
    assert.equal(searchCatalog(CATALOG, 'a', 5).length, 5);
});

test('buildSuggestions põe as cervejas do utilizador à frente e sem repetidos', () => {
    const user = [
        { name: 'Super Bock', brand: 'Super Bock', type: 'Lager', abv: 5.1, date: '2024-01-01' },
        { name: 'super bock', brand: 'Super Bock', type: 'Lager', abv: 5.2, date: '2025-01-01' },
        { name: 'Cerveja da Casa', brand: 'Tasca', type: 'Outro', abv: 4, date: '2025-02-01' }
    ];
    const list = buildSuggestions(user, CATALOG);
    const superBocks = list.filter((e) => normalize(e.name) === 'super bock');
    assert.equal(superBocks.length, 1);
    assert.equal(superBocks[0].abv, 5.2);
    assert.equal(superBocks[0].mine, true);

    const results = searchCatalog(list, 'super bock');
    assert.equal(results[0].mine, true);
    assert.ok(findByName(list, 'CERVEJA DA CASA').mine);
    assert.equal(findByName(list, ''), null);
});
