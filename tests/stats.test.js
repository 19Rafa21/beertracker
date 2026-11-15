const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/stats.js');

const beers = [
    { id: 1, name: 'Super Bock', brand: 'Super Bock', type: 'Lager', country: 'Portugal', abv: 5.2, rating: 4, date: '2025-02-15', notes: '' },
    { id: 2, name: 'Sagres', brand: 'Sagres', type: 'Lager', country: 'Portugal', abv: 5.1, rating: 3, date: '2025-03-01', notes: 'Fresca' },
    { id: 3, name: 'Guinness', brand: 'Guinness', type: 'Stout', country: 'Irlanda', abv: 4.2, rating: 4.5, date: '2025-01-10', notes: 'Cremosa' },
    { id: 4, name: 'Leffe Blonde', brand: 'Leffe', type: 'Ale', country: 'Bélgica', abv: 6.6, rating: 4.5, date: '2025-03-05', notes: '' }
];

test('countBy agrupa por campo e ignora valores vazios', () => {
    assert.deepEqual(S.countBy(beers, 'country'), { Portugal: 2, Irlanda: 1, 'Bélgica': 1 });
    assert.deepEqual(S.countBy([{ type: '' }, { type: 'IPA' }], 'type'), { IPA: 1 });
});

test('sortCounts ordena por contagem e depois alfabeticamente', () => {
    assert.deepEqual(S.sortCounts({ b: 1, a: 1, c: 3 }).map((x) => x.label), ['c', 'a', 'b']);
});

test('computeStats calcula totais, médias e destaques', () => {
    const stats = S.computeStats(beers);
    assert.equal(stats.total, 4);
    assert.equal(stats.countries, 3);
    assert.equal(stats.types, 3);
    assert.equal(stats.brands, 4);
    assert.ok(Math.abs(stats.avgRating - 16 / 4) < 1e-9);
    assert.ok(Math.abs(stats.avgAbv - 21.1 / 4) < 1e-9);
    assert.equal(stats.topCountry, 'Portugal');
    assert.equal(stats.topType, 'Lager');
    // Empate a 4.5: ganha a mais recente.
    assert.equal(stats.best.name, 'Leffe Blonde');
    assert.equal(stats.ratingByType.Lager, 3.5);
});

test('computeStats não aponta favorito quando há empate', () => {
    const stats = S.computeStats([beers[0], beers[2]]);
    assert.equal(stats.topCountry, null);
    assert.equal(stats.topType, null);
});

test('computeStats com lista vazia', () => {
    const stats = S.computeStats([]);
    assert.equal(stats.total, 0);
    assert.equal(stats.countries, 0);
    assert.equal(stats.avgRating, 0);
    assert.equal(stats.avgAbv, 0);
    assert.equal(stats.best, null);
    assert.equal(stats.topCountry, null);
    assert.deepEqual(stats.byCountry, {});
});

test('countByMonth devolve os últimos N meses, incluindo a passagem de ano', () => {
    const result = S.countByMonth(beers, '2025-03-20', 4);
    assert.deepEqual(result.map((m) => m.key), ['2024-12', '2025-01', '2025-02', '2025-03']);
    assert.deepEqual(result.map((m) => m.count), [0, 1, 1, 2]);
    assert.equal(result[0].label, 'dez 24');
});

test('isValidIsoDate', () => {
    assert.ok(S.isValidIsoDate('2024-02-29'));
    assert.ok(!S.isValidIsoDate('2025-02-29'));
    assert.ok(!S.isValidIsoDate('2025-13-01'));
    assert.ok(!S.isValidIsoDate('15/02/2025'));
});

test('validateBeer normaliza e aceita uma cerveja válida', () => {
    const { beer, errors } = S.validateBeer({
        name: '  Sagres ', brand: 'Sagres', type: 'Lager', country: 'Portugal',
        abv: '5,1', rating: '3.5', date: '2025-03-01', notes: ' boa '
    }, '2025-12-31');
    assert.deepEqual(errors, {});
    assert.equal(beer.name, 'Sagres');
    assert.equal(beer.abv, 5.1);
    assert.equal(beer.rating, 3.5);
    assert.equal(beer.notes, 'boa');
});

test('validateBeer aponta os erros', () => {
    const { errors } = S.validateBeer({
        name: '', brand: 'X', type: 'Lager', country: 'PT', abv: 120, rating: 4.3, date: '2030-01-01'
    }, '2025-12-31');
    assert.deepEqual(Object.keys(errors).sort(), ['abv', 'date', 'name', 'rating']);
    assert.match(errors.date, /futuro/);
});

test('filterBeers pesquisa sem acentos, por várias palavras e por tipo', () => {
    assert.deepEqual(S.filterBeers(beers, { query: 'belgica' }).map((b) => b.id), [4]);
    assert.deepEqual(S.filterBeers(beers, { query: 'portugal fresca' }).map((b) => b.id), [2]);
    assert.deepEqual(S.filterBeers(beers, { type: 'Lager' }).map((b) => b.id), [1, 2]);
    assert.equal(S.filterBeers(beers, {}).length, 4);
});

test('sortBeers ordena por texto, número e data', () => {
    assert.deepEqual(S.sortBeers(beers, 'date', 'desc').map((b) => b.id), [4, 2, 1, 3]);
    assert.deepEqual(S.sortBeers(beers, 'name', 'asc').map((b) => b.id), [3, 4, 2, 1]);
    assert.deepEqual(S.sortBeers(beers, 'rating', 'asc').map((b) => b.id), [2, 1, 3, 4]);
    // Não altera o array original.
    assert.equal(beers[0].id, 1);
});

test('parseBackup aceita lista ou { beers } e ignora entradas inválidas', () => {
    const json = JSON.stringify({ beers: [beers[0], { name: 'Má' }, 42] });
    const result = S.parseBackup(json);
    assert.equal(result.beers.length, 1);
    assert.equal(result.skipped, 2);
    assert.throws(() => S.parseBackup('não é json'), /JSON/);
    assert.throws(() => S.parseBackup('{"a":1}'), /lista/);
});

test('monthSpan conta os meses entre registos, com mínimo e máximo', () => {
    const { monthSpan } = S;
    assert.equal(monthSpan('2025-02-15', '2025-03-01', 6, 12), 6);
    assert.equal(monthSpan('2024-12-01', '2025-09-30', 6, 12), 10);
    assert.equal(monthSpan('2020-01-01', '2025-09-30', 6, 12), 12);
    assert.equal(monthSpan('', '2025-09-30', 6, 12), 6);
});
