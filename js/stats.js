// Lógica pura (sem DOM): estatísticas, validação, filtros e ordenação.
// Pode ser testada com `npm test`. No browser fica em window.BeerStats; no Node via require().
(function (root) {
    'use strict';

    const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    // Conta quantas cervejas existem por valor de um campo (ex.: 'country', 'type').
    // Valores vazios são ignorados.
    function countBy(beers, key) {
        const counts = {};
        beers.forEach(function (beer) {
            const value = beer[key];
            if (value === undefined || value === null || value === '') {
                return;
            }
            counts[value] = (counts[value] || 0) + 1;
        });
        return counts;
    }

    // Ordena um objeto de contagens do maior para o menor (empate: ordem alfabética).
    function sortCounts(counts) {
        return Object.keys(counts)
            .map(function (label) { return { label: label, count: counts[label] }; })
            .sort(function (a, b) {
                return b.count - a.count || a.label.localeCompare(b.label, 'pt');
            });
    }

    // Primeiro lugar, só se não houver empate (senão "o mais frequente" não faz sentido).
    function clearLeader(counts) {
        const sorted = sortCounts(counts);
        if (!sorted.length || (sorted[1] && sorted[1].count === sorted[0].count)) {
            return null;
        }
        return sorted[0];
    }

    function average(values) {
        const valid = values.filter(function (v) { return typeof v === 'number' && isFinite(v); });
        if (!valid.length) {
            return 0;
        }
        return valid.reduce(function (sum, v) { return sum + v; }, 0) / valid.length;
    }

    // Avaliação média por grupo (ex.: por tipo).
    function averageBy(beers, key, field) {
        const groups = {};
        beers.forEach(function (beer) {
            const group = beer[key];
            if (!group) {
                return;
            }
            (groups[group] = groups[group] || []).push(beer[field]);
        });
        const result = {};
        Object.keys(groups).forEach(function (group) {
            result[group] = average(groups[group]);
        });
        return result;
    }

    // Número de cervejas por mês ('AAAA-MM'), dos últimos `months` meses até `today` inclusive.
    // `today` é uma string 'AAAA-MM-DD'.
    function countByMonth(beers, today, months) {
        const parts = String(today).split('-');
        let year = Number(parts[0]);
        let month = Number(parts[1]);
        const keys = [];
        for (let i = 0; i < months; i++) {
            keys.unshift(year + '-' + String(month).padStart(2, '0'));
            month -= 1;
            if (month === 0) {
                month = 12;
                year -= 1;
            }
        }
        const counts = {};
        keys.forEach(function (k) { counts[k] = 0; });
        beers.forEach(function (beer) {
            const key = String(beer.date).slice(0, 7);
            if (key in counts) {
                counts[key] += 1;
            }
        });
        return keys.map(function (k) {
            const m = Number(k.slice(5, 7));
            return { key: k, label: MONTHS_PT[m - 1] + ' ' + k.slice(2, 4), count: counts[k] };
        });
    }

    function bestBeer(beers) {
        return beers.reduce(function (best, beer) {
            if (!best || beer.rating > best.rating ||
                (beer.rating === best.rating && String(beer.date) > String(best.date))) {
                return beer;
            }
            return best;
        }, null);
    }

    function computeStats(beers) {
        const byCountry = countBy(beers, 'country');
        const byType = countBy(beers, 'type');
        const topCountry = clearLeader(byCountry);
        const topType = clearLeader(byType);

        return {
            total: beers.length,
            countries: Object.keys(byCountry).length,
            types: Object.keys(byType).length,
            brands: Object.keys(countBy(beers, 'brand')).length,
            avgRating: average(beers.map(function (b) { return b.rating; })),
            avgAbv: average(beers.map(function (b) { return b.abv; })),
            topCountry: topCountry ? topCountry.label : null,
            topType: topType ? topType.label : null,
            best: bestBeer(beers),
            byCountry: byCountry,
            byType: byType,
            ratingByType: averageBy(beers, 'type', 'rating')
        };
    }

    // ---------- Validação ----------

    function isValidIsoDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
            return false;
        }
        const parts = value.split('-').map(Number);
        const daysInMonth = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
        return parts[1] >= 1 && parts[1] <= 12 && parts[2] >= 1 && parts[2] <= daysInMonth;
    }

    // Normaliza e valida uma cerveja. Devolve { beer, errors } onde errors é
    // um objeto { campo: mensagem }. `today` ('AAAA-MM-DD') impede datas futuras.
    function validateBeer(input, today) {
        const text = function (v) { return String(v === undefined || v === null ? '' : v).trim(); };
        const beer = {
            id: input.id,
            name: text(input.name),
            brand: text(input.brand),
            type: text(input.type),
            country: text(input.country),
            abv: parseFloat(String(input.abv).replace(',', '.')),
            rating: parseFloat(String(input.rating).replace(',', '.')),
            date: text(input.date),
            notes: text(input.notes)
        };
        const errors = {};

        if (!beer.name) { errors.name = 'Indique o nome da cerveja.'; }
        if (!beer.brand) { errors.brand = 'Indique a marca.'; }
        if (!beer.type) { errors.type = 'Escolha um tipo.'; }
        if (!beer.country) { errors.country = 'Indique o país.'; }
        if (!isFinite(beer.abv) || beer.abv < 0 || beer.abv > 100) {
            errors.abv = 'O teor alcoólico tem de estar entre 0 e 100.';
        }
        if (!isFinite(beer.rating) || beer.rating < 1 || beer.rating > 5 || (beer.rating * 2) % 1 !== 0) {
            errors.rating = 'A avaliação vai de 1 a 5, em meios pontos.';
        }
        if (!isValidIsoDate(beer.date)) {
            errors.date = 'Data inválida.';
        } else if (today && beer.date > today) {
            errors.date = 'A data não pode ser no futuro.';
        }

        return { beer: beer, errors: errors };
    }

    // ---------- Pesquisa e ordenação ----------

    // Remove acentos e passa a minúsculas, para pesquisar "belgica" e encontrar "Bélgica".
    function normalizeText(value) {
        return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    function filterBeers(beers, options) {
        const query = normalizeText(options && options.query).trim();
        const type = options && options.type;
        return beers.filter(function (beer) {
            if (type && beer.type !== type) {
                return false;
            }
            if (!query) {
                return true;
            }
            const haystack = normalizeText([beer.name, beer.brand, beer.type, beer.country, beer.notes].join(' '));
            return query.split(/\s+/).every(function (word) { return haystack.indexOf(word) !== -1; });
        });
    }

    const NUMERIC_FIELDS = { abv: true, rating: true };

    function sortBeers(beers, field, direction) {
        const dir = direction === 'asc' ? 1 : -1;
        return beers.slice().sort(function (a, b) {
            let cmp;
            if (NUMERIC_FIELDS[field]) {
                cmp = (Number(a[field]) || 0) - (Number(b[field]) || 0);
            } else {
                cmp = String(a[field] || '').localeCompare(String(b[field] || ''), 'pt', { sensitivity: 'base' });
            }
            if (cmp === 0 && field !== 'date') {
                cmp = String(a.date).localeCompare(String(b.date));
            }
            return cmp * dir;
        });
    }

    // ---------- Importação ----------

    // Valida um array vindo de um ficheiro de cópia de segurança.
    // Devolve { beers, skipped } — entradas inválidas são ignoradas.
    function parseBackup(json) {
        let data;
        try {
            data = JSON.parse(json);
        } catch (e) {
            throw new Error('O ficheiro não é JSON válido.');
        }
        if (data && !Array.isArray(data) && Array.isArray(data.beers)) {
            data = data.beers;
        }
        if (!Array.isArray(data)) {
            throw new Error('O ficheiro não contém uma lista de cervejas.');
        }
        const beers = [];
        let skipped = 0;
        data.forEach(function (item) {
            if (!item || typeof item !== 'object') {
                skipped += 1;
                return;
            }
            const result = validateBeer(item);
            if (Object.keys(result.errors).length) {
                skipped += 1;
                return;
            }
            beers.push(result.beer);
        });
        return { beers: beers, skipped: skipped };
    }

    const api = {
        countBy: countBy,
        sortCounts: sortCounts,
        average: average,
        averageBy: averageBy,
        countByMonth: countByMonth,
        bestBeer: bestBeer,
        computeStats: computeStats,
        isValidIsoDate: isValidIsoDate,
        validateBeer: validateBeer,
        normalizeText: normalizeText,
        filterBeers: filterBeers,
        sortBeers: sortBeers,
        parseBackup: parseBackup
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.BeerStats = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
