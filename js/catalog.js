// Catálogo de cervejas conhecidas, para sugerir nome, marca, tipo e teor alcoólico
// ao registar. Sem DOM: no browser fica em window.BeerCatalog; no Node via require().
//
// Cada entrada: [nome, marca, tipo, teor alcoólico (%), país de origem].
// O teor é o da versão mais comum; pode variar ligeiramente entre mercados.
// Os tipos usam as mesmas categorias do formulário (Lager, Pilsner, IPA, Pale Ale,
// Ale, Stout, Porter, Weiss, Sour, Outro).
(function (root) {
    'use strict';

    const RAW = [
        // Portugal
        ['Super Bock', 'Super Bock', 'Lager', 5.2, 'Portugal'],
        ['Super Bock Stout', 'Super Bock', 'Stout', 5.0, 'Portugal'],
        ['Super Bock Sem Álcool', 'Super Bock', 'Lager', 0.5, 'Portugal'],
        ['Sagres', 'Sagres', 'Lager', 5.0, 'Portugal'],
        ['Sagres Preta', 'Sagres', 'Lager', 4.3, 'Portugal'],
        ['Sagres Bohemia', 'Sagres', 'Lager', 6.2, 'Portugal'],
        ['Coral', 'Coral', 'Lager', 5.4, 'Portugal'],

        // Espanha
        ['Estrella Damm', 'Damm', 'Lager', 5.4, 'Espanha'],
        ['Voll-Damm', 'Damm', 'Lager', 7.2, 'Espanha'],
        ['Estrella Galicia', 'Estrella Galicia', 'Lager', 5.5, 'Espanha'],
        ['Mahou Cinco Estrellas', 'Mahou', 'Lager', 5.5, 'Espanha'],
        ['Alhambra Reserva 1925', 'Alhambra', 'Lager', 6.4, 'Espanha'],
        ['San Miguel Especial', 'San Miguel', 'Lager', 5.4, 'Espanha'],
        ['Cruzcampo', 'Cruzcampo', 'Lager', 4.8, 'Espanha'],
        ['Moritz', 'Moritz', 'Lager', 5.4, 'Espanha'],

        // Irlanda
        ['Guinness Draught', 'Guinness', 'Stout', 4.2, 'Irlanda'],
        ['Guinness Foreign Extra Stout', 'Guinness', 'Stout', 7.5, 'Irlanda'],
        ["Murphy's Irish Stout", "Murphy's", 'Stout', 4.0, 'Irlanda'],
        ['Beamish Irish Stout', 'Beamish', 'Stout', 4.1, 'Irlanda'],
        ['Kilkenny Irish Red Ale', 'Kilkenny', 'Ale', 4.3, 'Irlanda'],
        ["Smithwick's Red Ale", "Smithwick's", 'Ale', 3.8, 'Irlanda'],

        // Reino Unido
        ['Newcastle Brown Ale', 'Newcastle', 'Ale', 4.7, 'Reino Unido'],
        ["Fuller's London Pride", "Fuller's", 'Ale', 4.7, 'Reino Unido'],
        ["Fuller's ESB", "Fuller's", 'Ale', 5.9, 'Reino Unido'],
        ["Fuller's London Porter", "Fuller's", 'Porter', 5.4, 'Reino Unido'],
        ['Old Speckled Hen', 'Greene King', 'Ale', 5.0, 'Reino Unido'],
        ['Punk IPA', 'BrewDog', 'IPA', 5.4, 'Reino Unido'],
        ['Hazy Jane', 'BrewDog', 'IPA', 5.0, 'Reino Unido'],
        ['Elvis Juice', 'BrewDog', 'IPA', 6.5, 'Reino Unido'],
        ["Samuel Smith's Oatmeal Stout", "Samuel Smith's", 'Stout', 5.0, 'Reino Unido'],
        ["Samuel Smith's Taddy Porter", "Samuel Smith's", 'Porter', 5.0, 'Reino Unido'],

        // Países Baixos
        ['Heineken', 'Heineken', 'Lager', 5.0, 'Países Baixos'],
        ['Amstel', 'Amstel', 'Lager', 5.0, 'Países Baixos'],
        ['Grolsch Premium Pilsner', 'Grolsch', 'Pilsner', 5.0, 'Países Baixos'],
        ['Hertog Jan Pilsener', 'Hertog Jan', 'Pilsner', 5.1, 'Países Baixos'],
        ['La Trappe Quadrupel', 'La Trappe', 'Ale', 10.0, 'Países Baixos'],

        // Bélgica
        ['Leffe Blonde', 'Leffe', 'Ale', 6.6, 'Bélgica'],
        ['Leffe Brune', 'Leffe', 'Ale', 6.5, 'Bélgica'],
        ['Duvel', 'Duvel', 'Ale', 8.5, 'Bélgica'],
        ['Duvel Tripel Hop', 'Duvel', 'Ale', 9.5, 'Bélgica'],
        ['Chimay Rouge', 'Chimay', 'Ale', 7.0, 'Bélgica'],
        ['Chimay Bleue', 'Chimay', 'Ale', 9.0, 'Bélgica'],
        ['Chimay Triple', 'Chimay', 'Ale', 8.0, 'Bélgica'],
        ['Westmalle Dubbel', 'Westmalle', 'Ale', 7.0, 'Bélgica'],
        ['Westmalle Tripel', 'Westmalle', 'Ale', 9.5, 'Bélgica'],
        ['Orval', 'Orval', 'Ale', 6.2, 'Bélgica'],
        ['Rochefort 8', 'Rochefort', 'Ale', 9.2, 'Bélgica'],
        ['Rochefort 10', 'Rochefort', 'Ale', 11.3, 'Bélgica'],
        ['Westvleteren 12', 'Westvleteren', 'Ale', 10.2, 'Bélgica'],
        ['St. Bernardus Abt 12', 'St. Bernardus', 'Ale', 10.0, 'Bélgica'],
        ['La Chouffe', 'Chouffe', 'Ale', 8.0, 'Bélgica'],
        ['Delirium Tremens', 'Delirium', 'Ale', 8.5, 'Bélgica'],
        ['Kwak', 'Kwak', 'Ale', 8.4, 'Bélgica'],
        ['Tripel Karmeliet', 'Karmeliet', 'Ale', 8.4, 'Bélgica'],
        ['Affligem Blonde', 'Affligem', 'Ale', 6.7, 'Bélgica'],
        ['Grimbergen Blonde', 'Grimbergen', 'Ale', 6.7, 'Bélgica'],
        ['Brugse Zot Blond', 'Brugse Zot', 'Ale', 6.0, 'Bélgica'],
        ['Straffe Hendrik Tripel', 'Straffe Hendrik', 'Ale', 9.0, 'Bélgica'],
        ['Gulden Draak', 'Gulden Draak', 'Ale', 10.5, 'Bélgica'],
        ['Kasteel Donker', 'Kasteel', 'Ale', 11.0, 'Bélgica'],
        ['Saison Dupont', 'Dupont', 'Ale', 6.5, 'Bélgica'],
        ['Hoegaarden', 'Hoegaarden', 'Weiss', 4.9, 'Bélgica'],
        ['Stella Artois', 'Stella Artois', 'Lager', 5.2, 'Bélgica'],
        ['Jupiler', 'Jupiler', 'Lager', 5.2, 'Bélgica'],
        ['Rodenbach Grand Cru', 'Rodenbach', 'Sour', 6.0, 'Bélgica'],
        ['Lindemans Kriek', 'Lindemans', 'Sour', 3.5, 'Bélgica'],
        ['Lindemans Framboise', 'Lindemans', 'Sour', 2.5, 'Bélgica'],
        ['Cantillon Gueuze', 'Cantillon', 'Sour', 5.0, 'Bélgica'],

        // Alemanha
        ['Paulaner Hefe-Weissbier', 'Paulaner', 'Weiss', 5.5, 'Alemanha'],
        ['Paulaner Münchner Hell', 'Paulaner', 'Lager', 4.9, 'Alemanha'],
        ['Paulaner Salvator', 'Paulaner', 'Lager', 7.9, 'Alemanha'],
        ['Erdinger Weissbier', 'Erdinger', 'Weiss', 5.3, 'Alemanha'],
        ['Erdinger Dunkel', 'Erdinger', 'Weiss', 5.3, 'Alemanha'],
        ['Weihenstephaner Hefeweissbier', 'Weihenstephaner', 'Weiss', 5.4, 'Alemanha'],
        ['Weihenstephaner Hefeweissbier Dunkel', 'Weihenstephaner', 'Weiss', 5.3, 'Alemanha'],
        ['Weihenstephaner Vitus', 'Weihenstephaner', 'Weiss', 7.7, 'Alemanha'],
        ['Franziskaner Hefe-Weissbier', 'Franziskaner', 'Weiss', 5.0, 'Alemanha'],
        ['Schneider Weisse TAP7', 'Schneider Weisse', 'Weiss', 5.4, 'Alemanha'],
        ['Ayinger Bräuweisse', 'Ayinger', 'Weiss', 5.1, 'Alemanha'],
        ['Ayinger Celebrator', 'Ayinger', 'Lager', 6.7, 'Alemanha'],
        ['Augustiner Lagerbier Hell', 'Augustiner', 'Lager', 5.2, 'Alemanha'],
        ['Spaten Münchner Hell', 'Spaten', 'Lager', 5.2, 'Alemanha'],
        ['Löwenbräu Original', 'Löwenbräu', 'Lager', 5.2, 'Alemanha'],
        ['Hofbräu Original', 'Hofbräu', 'Lager', 5.1, 'Alemanha'],
        ["Beck's", "Beck's", 'Pilsner', 4.9, 'Alemanha'],
        ['Bitburger Premium Pils', 'Bitburger', 'Pilsner', 4.8, 'Alemanha'],
        ['Warsteiner Premium Verum', 'Warsteiner', 'Pilsner', 4.8, 'Alemanha'],
        ['Krombacher Pils', 'Krombacher', 'Pilsner', 4.8, 'Alemanha'],
        ['Jever Pilsener', 'Jever', 'Pilsner', 4.9, 'Alemanha'],
        ['Radeberger Pilsner', 'Radeberger', 'Pilsner', 4.8, 'Alemanha'],
        ['Köstritzer Schwarzbier', 'Köstritzer', 'Lager', 4.8, 'Alemanha'],
        ['Aecht Schlenkerla Rauchbier Märzen', 'Schlenkerla', 'Outro', 5.1, 'Alemanha'],
        ['Früh Kölsch', 'Früh', 'Ale', 4.8, 'Alemanha'],
        ['Diebels Alt', 'Diebels', 'Ale', 4.9, 'Alemanha'],

        // Chéquia, Polónia e resto da Europa
        ['Pilsner Urquell', 'Pilsner Urquell', 'Pilsner', 4.4, 'Chéquia'],
        ['Budweiser Budvar', 'Budějovický Budvar', 'Lager', 5.0, 'Chéquia'],
        ['Staropramen', 'Staropramen', 'Lager', 5.0, 'Chéquia'],
        ['Kozel Černý', 'Kozel', 'Lager', 3.8, 'Chéquia'],
        ['Żywiec', 'Żywiec', 'Lager', 5.6, 'Polónia'],
        ['Carlsberg', 'Carlsberg', 'Pilsner', 5.0, 'Dinamarca'],
        ['Tuborg Green', 'Tuborg', 'Pilsner', 4.6, 'Dinamarca'],
        ['Kronenbourg 1664', 'Kronenbourg', 'Lager', 5.5, 'França'],
        ['Desperados', 'Desperados', 'Outro', 5.9, 'França'],
        ['Peroni Nastro Azzurro', 'Peroni', 'Lager', 5.1, 'Itália'],
        ['Birra Moretti', 'Moretti', 'Lager', 4.6, 'Itália'],
        ['Menabrea Bionda', 'Menabrea', 'Lager', 4.8, 'Itália'],
        ['Ichnusa', 'Ichnusa', 'Lager', 4.7, 'Itália'],
        ['Mythos', 'Mythos', 'Lager', 4.7, 'Grécia'],
        ['Efes Pilsen', 'Efes', 'Pilsner', 5.0, 'Turquia'],

        // Américas
        ['Corona Extra', 'Corona', 'Lager', 4.5, 'México'],
        ['Modelo Especial', 'Modelo', 'Lager', 4.4, 'México'],
        ['Negra Modelo', 'Modelo', 'Lager', 5.4, 'México'],
        ['Sol', 'Sol', 'Lager', 4.5, 'México'],
        ['Pacífico', 'Pacífico', 'Lager', 4.5, 'México'],
        ['Dos Equis Lager', 'Dos Equis', 'Lager', 4.2, 'México'],
        ['Budweiser', 'Budweiser', 'Lager', 5.0, 'Estados Unidos'],
        ['Bud Light', 'Budweiser', 'Lager', 4.2, 'Estados Unidos'],
        ['Coors Light', 'Coors', 'Lager', 4.2, 'Estados Unidos'],
        ['Pabst Blue Ribbon', 'Pabst', 'Lager', 4.7, 'Estados Unidos'],
        ['Samuel Adams Boston Lager', 'Samuel Adams', 'Lager', 5.0, 'Estados Unidos'],
        ['Brooklyn Lager', 'Brooklyn', 'Lager', 5.2, 'Estados Unidos'],
        ['Sierra Nevada Pale Ale', 'Sierra Nevada', 'Pale Ale', 5.6, 'Estados Unidos'],
        ['Sierra Nevada Torpedo', 'Sierra Nevada', 'IPA', 7.2, 'Estados Unidos'],
        ['Lagunitas IPA', 'Lagunitas', 'IPA', 6.2, 'Estados Unidos'],
        ['Goose Island IPA', 'Goose Island', 'IPA', 5.9, 'Estados Unidos'],
        ['Stone IPA', 'Stone', 'IPA', 6.9, 'Estados Unidos'],
        ['Founders All Day IPA', 'Founders', 'IPA', 4.7, 'Estados Unidos'],
        ['Founders Breakfast Stout', 'Founders', 'Stout', 8.3, 'Estados Unidos'],
        ['Blue Moon Belgian White', 'Blue Moon', 'Weiss', 5.4, 'Estados Unidos'],
        ['Anchor Steam Beer', 'Anchor', 'Outro', 4.9, 'Estados Unidos'],
        ['Quilmes Cristal', 'Quilmes', 'Lager', 4.9, 'Argentina'],
        ['Cusqueña Dorada', 'Cusqueña', 'Lager', 4.8, 'Peru'],

        // Ásia e Oceânia
        ['Asahi Super Dry', 'Asahi', 'Lager', 5.0, 'Japão'],
        ['Kirin Ichiban', 'Kirin', 'Lager', 5.0, 'Japão'],
        ['Sapporo Premium', 'Sapporo', 'Lager', 4.9, 'Japão'],
        ['Tsingtao', 'Tsingtao', 'Lager', 4.7, 'China'],
        ['Singha', 'Singha', 'Lager', 5.0, 'Tailândia'],
        ['Chang Classic', 'Chang', 'Lager', 5.0, 'Tailândia'],
        ['Tiger', 'Tiger', 'Lager', 5.0, 'Singapura'],
        ['San Miguel Pale Pilsen', 'San Miguel', 'Pilsner', 5.0, 'Filipinas'],
        ['Kingfisher Premium', 'Kingfisher', 'Lager', 4.8, 'Índia'],
        ['Victoria Bitter', 'Carlton', 'Lager', 4.9, 'Austrália'],
        ['Coopers Pale Ale', 'Coopers', 'Pale Ale', 4.5, 'Austrália']
    ];

    const CATALOG = RAW.map(function (row) {
        return { name: row[0], brand: row[1], type: row[2], abv: row[3], origin: row[4] };
    });

    // Remove acentos e passa a minúsculas ("Bräu" encontra "brau").
    function normalize(value) {
        return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    }

    // Junta as cervejas já registadas pelo utilizador (primeiro, a mais recente de cada nome)
    // com o catálogo. Se o nome existir nos dois, fica a versão do utilizador.
    function buildSuggestions(userBeers, catalog) {
        const seen = {};
        const result = [];
        (userBeers || []).slice()
            .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
            .forEach(function (beer) {
                const key = normalize(beer.name);
                if (!key || seen[key]) {
                    return;
                }
                seen[key] = true;
                result.push({ name: beer.name, brand: beer.brand, type: beer.type, abv: Number(beer.abv), origin: '', mine: true });
            });
        (catalog || CATALOG).forEach(function (entry) {
            const key = normalize(entry.name);
            if (seen[key]) {
                return;
            }
            seen[key] = true;
            result.push(entry);
        });
        return result;
    }

    // Procura por nome e marca. Todas as palavras têm de aparecer; os resultados cujo
    // nome começa pela pesquisa vêm primeiro, depois os que têm uma palavra a começar
    // por ela, depois o resto. Dentro de cada grupo, as do utilizador primeiro.
    function searchCatalog(entries, query, limit) {
        const q = normalize(query);
        if (!q) {
            return [];
        }
        const words = q.split(/\s+/);
        const scored = [];
        entries.forEach(function (entry) {
            const name = normalize(entry.name);
            const haystack = name + ' ' + normalize(entry.brand);
            const matchesAll = words.every(function (w) { return haystack.indexOf(w) !== -1; });
            if (!matchesAll) {
                return;
            }
            let score = 3;
            if (name.indexOf(q) === 0) {
                score = 0;
            } else if ((' ' + name).indexOf(' ' + q) !== -1) {
                score = 1;
            } else if (name.indexOf(q) !== -1) {
                score = 2;
            }
            scored.push({ entry: entry, score: score });
        });
        scored.sort(function (a, b) {
            return a.score - b.score ||
                (b.entry.mine ? 1 : 0) - (a.entry.mine ? 1 : 0) ||
                a.entry.name.localeCompare(b.entry.name, 'pt');
        });
        return scored.slice(0, limit || 8).map(function (s) { return s.entry; });
    }

    // Procura uma entrada pelo nome exato (sem diferenciar acentos/maiúsculas).
    function findByName(entries, name) {
        const key = normalize(name);
        if (!key) {
            return null;
        }
        return entries.find(function (e) { return normalize(e.name) === key; }) || null;
    }

    const api = {
        CATALOG: CATALOG,
        normalize: normalize,
        buildSuggestions: buildSuggestions,
        searchCatalog: searchCatalog,
        findByName: findByName
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.BeerCatalog = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
