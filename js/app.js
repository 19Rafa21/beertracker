(function () {
    'use strict';

    const STORAGE_KEY = 'beers';
    const THEME_KEY = 'theme';
    const UNDO_TIMEOUT = 6000;

    const SAMPLE_BEERS = [
        { id: 1, name: 'Super Bock', brand: 'Super Bock', type: 'Lager', country: 'Portugal', abv: 5.2, rating: 4, date: '2025-02-15', notes: 'Clássica portuguesa.' },
        { id: 2, name: 'Guinness Draught', brand: 'Guinness', type: 'Stout', country: 'Irlanda', abv: 4.2, rating: 4.5, date: '2025-02-20', notes: 'Cremosa e suave.' },
        { id: 3, name: 'Heineken', brand: 'Heineken', type: 'Lager', country: 'Holanda', abv: 5.0, rating: 3.5, date: '2025-02-22', notes: 'Refrescante.' },
        { id: 4, name: 'Leffe Blonde', brand: 'Leffe', type: 'Ale', country: 'Bélgica', abv: 6.6, rating: 4.5, date: '2025-02-27', notes: 'Suave com notas de baunilha.' },
        { id: 5, name: 'Paulaner Hefe-Weissbier', brand: 'Paulaner', type: 'Weiss', country: 'Alemanha', abv: 5.5, rating: 4, date: '2025-03-01', notes: 'Notas de banana e cravo.' }
    ];

    // Paleta quente para países; cada tipo de cerveja tem a cor do próprio copo.
    const CHART_COLORS = [
        '#f2a20c', '#b4500f', '#3d8b7a', '#d95d39', '#5a7fb8',
        '#c9a227', '#7a3b12', '#e8c27a', '#8a9a5b', '#a63d40'
    ];

    const TYPE_COLORS = {
        'Lager': '#f2b705',
        'Pilsner': '#f7d046',
        'IPA': '#e8860c',
        'Pale Ale': '#d9951a',
        'Ale': '#b8621b',
        'Stout': '#2b1608',
        'Porter': '#5a2d0c',
        'Weiss': '#f3d98b',
        'Sour': '#d9485f',
        'Outro': '#9a8b78'
    };

    function typeColor(type) {
        return TYPE_COLORS[type] || '#9a8b78';
    }

    // Abreviatura impressa na carica de cada cerveja.
    const TYPE_ABBR = {
        'Lager': 'LAG', 'Pilsner': 'PIL', 'IPA': 'IPA', 'Pale Ale': 'APA', 'Ale': 'ALE',
        'Stout': 'STO', 'Porter': 'POR', 'Weiss': 'WEI', 'Sour': 'SOU', 'Outro': '···'
    };

    // Texto claro em caricas escuras, escuro em caricas claras.
    function capInk(hex) {
        const n = parseInt(String(hex).replace('#', ''), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.55 ? '#2a1600' : '#fff6e5';
    }

    // Rotação "ao calhas" mas estável para cada cerveja (as caricas não ficam todas direitas).
    function capRotation(id) {
        let h = 0;
        String(id).split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) % 997; });
        return (h % 51) - 25;
    }

    // Carica com a cor e a abreviatura do tipo. `extraClass` muda o tamanho/contexto.
    function capHtml(type, extraClass, label) {
        const color = typeColor(type);
        return '<span class="cap ' + (extraClass || '') + '" style="--type-color: ' + color + '; --cap-ink: ' + capInk(color) + '" aria-hidden="true">' +
            '<svg viewBox="-2 -2 44 44"><use href="#i-cap"/></svg>' +
            '<span class="cap-label">' + escapeHtml(label || TYPE_ABBR[type] || '···') + '</span></span>';
    }

    // Nº de cada cerveja pela ordem em que foi bebida (como um número de lote).
    function batchNumbers() {
        const numbers = {};
        BeerStats.sortBeers(beers, 'date', 'asc').forEach(function (beer, i) {
            numbers[beer.id] = String(i + 1).padStart(3, '0');
        });
        return numbers;
    }

    const PAGE_HASH = { home: '#inicio', stats: '#estatisticas', map: '#mapa' };
    const PAGE_TITLES = { home: 'Registo de Cervejas', stats: 'Estatísticas', map: 'Mapa de bares' };
    const FIELDS = ['name', 'brand', 'type', 'country', 'abv', 'rating', 'date', 'notes'];

    let beers = [];
    let charts = {};
    let currentPage = 'home';
    let sortState = { field: 'date', direction: 'desc' };
    let toastTimer = null;
    let highlightId = null;

    const $ = function (id) { return document.getElementById(id); };

    const form = $('beer-form');
    const beerListBody = $('beer-list');
    const searchInput = $('search');
    const filterType = $('filter-type');
    const pages = { home: $('home-page'), stats: $('stats-page'), map: $('map-page') };

    // ---------- Utilitários ----------

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 'AAAA-MM-DD' -> 'DD/MM/AAAA', sem passar por Date (evita desvios de fuso horário).
    function formatDate(isoDate) {
        const parts = String(isoDate).split('-');
        return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(isoDate);
    }

    // Data de hoje no fuso local, em 'AAAA-MM-DD'.
    function todayIso() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    // 'AAAA-MM-DD' -> { day: '15', month: 'fev', year: '2025' }, para a data dos cartões.
    function dateParts(isoDate) {
        const parts = String(isoDate).split('-');
        if (parts.length !== 3) {
            return { day: '', month: '', year: String(isoDate) };
        }
        return { day: String(Number(parts[2])), month: MONTHS_SHORT[Number(parts[1]) - 1] || '', year: parts[0] };
    }

    function formatNumber(value, decimals) {
        return Number(value).toLocaleString('pt-PT', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function starsHtml(rating) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (rating >= i) {
                html += '<span>★</span>';
            } else if (rating >= i - 0.5) {
                html += '<span class="star-half">★</span>';
            } else {
                html += '<span class="star-empty">★</span>';
            }
        }
        return '<span class="stars" aria-hidden="true">' + html + '</span>';
    }

    function ratingHtml(rating) {
        return starsHtml(rating) +
            '<span class="rating-number">' + escapeHtml(formatNumber(rating, 1)) + '</span>' +
            '<span class="visually-hidden"> de 5</span>';
    }

    function nextId() {
        const maxId = beers.reduce(function (max, b) { return Math.max(max, Number(b.id) || 0); }, 0);
        return Math.max(Date.now(), maxId + 1);
    }

    // ---------- Dados ----------

    // As cervejas de exemplo só entram na primeira utilização; se o utilizador
    // apagar tudo, a lista fica vazia.
    function loadBeers() {
        let stored = null;
        try {
            stored = localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            stored = null;
        }

        if (stored === null) {
            beers = SAMPLE_BEERS.slice();
            saveBeers();
            return;
        }

        try {
            const parsed = JSON.parse(stored);
            beers = Array.isArray(parsed) ? parsed.filter(function (b) { return b && typeof b === 'object'; }) : [];
        } catch (e) {
            beers = [];
        }
    }

    function saveBeers() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(beers));
        } catch (e) {
            showToast('Não deu para guardar. As caricas só ficam até fechares a página.');
        }
    }

    function upsertBeer(beer) {
        const index = beers.findIndex(function (b) { return b.id === beer.id; });
        if (index === -1) {
            beers.push(beer);
        } else {
            beers[index] = beer;
        }
        saveBeers();
        highlightId = beer.id;
        render();
    }

    function removeBeer(id) {
        const index = beers.findIndex(function (b) { return b.id === id; });
        if (index === -1) {
            return;
        }
        const removed = beers[index];
        beers.splice(index, 1);
        saveBeers();
        if (Number($('beer-id').value) === id) {
            resetForm();
        }
        render();

        showToast('"' + removed.name + '" saiu da coleção.', function () {
            beers.splice(Math.min(index, beers.length), 0, removed);
            highlightId = removed.id;
            saveBeers();
            render();
            showToast('Voltou para a coleção.');
        });
    }

    // ---------- Notificações ----------

    function showToast(message, undoCallback) {
        const toast = $('toast');
        const action = $('toast-action');
        $('toast-message').textContent = message;
        action.classList.toggle('hidden', !undoCallback);
        action.onclick = undoCallback ? function () { hideToast(); undoCallback(); } : null;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(hideToast, undoCallback ? UNDO_TIMEOUT : 3000);
    }

    function hideToast() {
        clearTimeout(toastTimer);
        $('toast').hidden = true;
    }

    // ---------- Formulário ----------

    function readForm() {
        const data = { id: Number($('beer-id').value) || null };
        FIELDS.forEach(function (field) {
            data[field] = $('beer-' + field).value;
        });
        return data;
    }

    function showErrors(errors) {
        let first = null;
        FIELDS.forEach(function (field) {
            const input = $('beer-' + field);
            const errorEl = $('error-' + field);
            const message = errors[field] || '';
            if (errorEl) {
                errorEl.textContent = message;
            }
            if (message) {
                input.setAttribute('aria-invalid', 'true');
                first = first || input;
            } else {
                input.removeAttribute('aria-invalid');
            }
        });
        return first;
    }

    function updateRatingOutput() {
        const value = Number($('beer-rating').value);
        $('rating-stars').innerHTML = starsHtml(value);
        $('rating-output').textContent = formatNumber(value, 1);
        $('beer-rating').setAttribute('aria-valuetext', formatNumber(value, 1) + ' de 5');
    }

    // Tocar/arrastar nas estrelas: a metade esquerda de cada estrela vale meio ponto.
    function initRatingStars() {
        const stars = $('rating-stars');
        const range = $('beer-rating');
        let dragging = false;
        function setFromPointer(event) {
            const rect = stars.getBoundingClientRect();
            const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
            const value = Math.max(1, Math.ceil(x * 10) / 2);
            if (Number(range.value) !== value) {
                range.value = value;
                updateRatingOutput();
            }
        }
        stars.addEventListener('pointerdown', function (event) {
            dragging = true;
            stars.setPointerCapture(event.pointerId);
            setFromPointer(event);
            range.focus({ preventScroll: true });
        });
        stars.addEventListener('pointermove', function (event) {
            if (dragging) {
                setFromPointer(event);
            }
        });
        stars.addEventListener('pointerup', function () { dragging = false; });
        stars.addEventListener('pointercancel', function () { dragging = false; });
    }

    // ---------- Formulário em folha (telemóvel) ----------

    const mobileQuery = window.matchMedia('(max-width: 720px)');

    function isSheetOpen() {
        return document.body.classList.contains('sheet-open');
    }

    // No computador o formulário está sempre visível: basta levar o utilizador até ele.
    // No telemóvel abre como uma folha que sobe do fundo do ecrã.
    function openForm() {
        const sheet = $('form-sheet');
        if (!mobileQuery.matches) {
            sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
            $('beer-name').focus({ preventScroll: true });
            return;
        }
        $('sheet-backdrop').hidden = false;
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        $('add-fab').setAttribute('aria-expanded', 'true');
        // Deixa o fundo aparecer antes de animar a folha.
        requestAnimationFrame(function () {
            document.body.classList.add('sheet-open');
            setTimeout(function () { $('beer-name').focus({ preventScroll: true }); }, 60);
        });
    }

    function closeForm(returnFocus) {
        if (!isSheetOpen()) {
            return;
        }
        const sheet = $('form-sheet');
        document.body.classList.remove('sheet-open');
        sheet.removeAttribute('role');
        sheet.removeAttribute('aria-modal');
        $('add-fab').setAttribute('aria-expanded', 'false');
        setTimeout(function () {
            if (!isSheetOpen()) {
                $('sheet-backdrop').hidden = true;
            }
        }, 260);
        if (returnFocus !== false) {
            $('add-fab').focus({ preventScroll: true });
        }
    }

    function resetForm() {
        form.reset();
        $('beer-id').value = '';
        $('beer-date').value = todayIso();
        $('beer-date').max = todayIso();
        $('beer-rating').value = 3;
        updateRatingOutput();
        showErrors({});
        closeSuggestions();
        $('name-hint').textContent = DEFAULT_NAME_HINT;
        $('form-title').textContent = 'Nova cerveja';
        $('submit-button').textContent = 'Guardar na coleção';
        $('form-batch').textContent = 'Ficha de prova · Nº ' + String(beers.length + 1).padStart(3, '0');
        $('cancel-edit').classList.add('hidden');
        document.querySelector('.beer-form').classList.remove('editing');
    }

    function startEdit(id) {
        const beer = beers.find(function (b) { return b.id === id; });
        if (!beer) {
            return;
        }
        $('beer-id').value = beer.id;
        FIELDS.forEach(function (field) {
            $('beer-' + field).value = beer[field] === undefined || beer[field] === null ? '' : beer[field];
        });
        updateRatingOutput();
        showErrors({});
        $('form-title').textContent = 'Editar ' + beer.name;
        $('form-batch').textContent = 'Ficha de prova · Nº ' + (batchNumbers()[beer.id] || '');
        $('submit-button').textContent = 'Guardar alterações';
        $('cancel-edit').classList.remove('hidden');
        document.querySelector('.beer-form').classList.add('editing');
        openForm();
    }

    function handleSubmit(event) {
        event.preventDefault();
        const result = BeerStats.validateBeer(readForm(), todayIso());
        const firstInvalid = showErrors(result.errors);
        if (firstInvalid) {
            firstInvalid.focus();
            return;
        }

        const isEdit = Boolean(result.beer.id);
        if (!isEdit) {
            result.beer.id = nextId();
        }
        upsertBeer(result.beer);
        showToast(isEdit ? 'Alterações guardadas.' : 'Saúde! "' + result.beer.name + '" entrou na coleção.');
        resetForm();
        if (isSheetOpen()) {
            closeForm();
        } else if (!isEdit) {
            $('beer-name').focus();
        }
    }

    // ---------- Sugestões de cervejas (catálogo + já registadas) ----------

    const DEFAULT_NAME_HINT = 'Escolhe uma sugestão e a marca, o tipo e o teor ficam preenchidos.';
    const suggest = { items: [], active: -1 };

    function suggestionSource() {
        return BeerCatalog.buildSuggestions(beers, BeerCatalog.CATALOG);
    }

    // Destaca a parte do nome que corresponde à pesquisa (sem diferenciar acentos).
    function highlightMatch(name, query) {
        const plain = BeerCatalog.normalize(name);
        const q = BeerCatalog.normalize(query);
        const start = q ? plain.indexOf(q) : -1;
        // A normalização mantém o número de caracteres para letras latinas comuns.
        if (start === -1 || plain.length !== name.length) {
            return escapeHtml(name);
        }
        return escapeHtml(name.slice(0, start)) +
            '<mark>' + escapeHtml(name.slice(start, start + q.length)) + '</mark>' +
            escapeHtml(name.slice(start + q.length));
    }

    function renderSuggestions(query) {
        const list = $('name-suggestions');
        const input = $('beer-name');
        suggest.items = BeerCatalog.searchCatalog(suggestionSource(), query, 7);
        suggest.active = -1;
        input.removeAttribute('aria-activedescendant');

        if (!suggest.items.length) {
            closeSuggestions();
            return;
        }
        list.innerHTML = suggest.items.map(function (item, i) {
            const meta = [item.brand, item.type, formatNumber(item.abv, 1) + '%'];
            return '<li role="option" id="suggestion-' + i + '" aria-selected="false" data-index="' + i + '" style="--type-color: ' + typeColor(item.type) + '">' +
                '<span class="combo-name">' + highlightMatch(item.name, query) + '</span>' +
                '<span class="combo-meta">' + escapeHtml(meta.join(' · ')) + '</span>' +
                '<span class="combo-tag">' + escapeHtml(item.mine ? 'Já bebeu' : item.origin) + '</span>' +
                '</li>';
        }).join('');
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    }

    function closeSuggestions() {
        $('name-suggestions').hidden = true;
        $('beer-name').setAttribute('aria-expanded', 'false');
        $('beer-name').removeAttribute('aria-activedescendant');
        suggest.active = -1;
    }

    function setActiveSuggestion(index) {
        const options = $('name-suggestions').querySelectorAll('[role="option"]');
        if (!options.length) {
            return;
        }
        suggest.active = (index + options.length) % options.length;
        options.forEach(function (option, i) {
            option.setAttribute('aria-selected', i === suggest.active ? 'true' : 'false');
        });
        const current = options[suggest.active];
        $('beer-name').setAttribute('aria-activedescendant', current.id);
        current.scrollIntoView({ block: 'nearest' });
    }

    // Preenche nome, marca, tipo e teor. O país fica de fora: é onde o utilizador a bebeu.
    function applySuggestion(item) {
        $('beer-name').value = item.name;
        $('beer-brand').value = item.brand;
        $('beer-type').value = item.type;
        $('beer-abv').value = item.abv;
        ['name', 'brand', 'type', 'abv'].forEach(function (field) {
            const input = $('beer-' + field);
            $('error-' + field).textContent = '';
            input.removeAttribute('aria-invalid');
            input.classList.remove('autofilled');
            void input.offsetWidth; // reinicia a animação
            input.classList.add('autofilled');
        });
        $('name-hint').textContent = item.mine
            ? 'Preenchido com o teu último registo desta cerveja.'
            : 'Preenchido a partir do catálogo · origem: ' + item.origin + '. Podes mudar qualquer campo.';
        closeSuggestions();
        const next = $('beer-country');
        (next.value ? $('beer-rating') : next).focus();
    }

    function initSuggestions() {
        const input = $('beer-name');
        const list = $('name-suggestions');

        input.addEventListener('input', function () {
            $('name-hint').textContent = DEFAULT_NAME_HINT;
            renderSuggestions(input.value);
        });
        input.addEventListener('focus', function () {
            if (input.value.trim() && !$('beer-brand').value) {
                renderSuggestions(input.value);
            }
        });
        input.addEventListener('keydown', function (event) {
            const open = !list.hidden;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                if (!open) {
                    renderSuggestions(input.value);
                }
                if (!list.hidden) {
                    event.preventDefault();
                    setActiveSuggestion(suggest.active + (event.key === 'ArrowDown' ? 1 : -1));
                }
            } else if (event.key === 'Enter' && open && suggest.active !== -1) {
                event.preventDefault();
                applySuggestion(suggest.items[suggest.active]);
            } else if (event.key === 'Escape' && open) {
                event.stopPropagation();
                closeSuggestions();
            } else if (event.key === 'Tab' && open) {
                closeSuggestions();
            }
        });
        input.addEventListener('blur', function () {
            // Dá tempo ao clique numa sugestão antes de fechar.
            setTimeout(closeSuggestions, 120);
        });
        // mousedown em vez de click: escolhe antes de o campo perder o foco.
        list.addEventListener('mousedown', function (event) {
            const option = event.target.closest('[role="option"]');
            event.preventDefault();
            if (option) {
                applySuggestion(suggest.items[Number(option.dataset.index)]);
            }
        });
    }

    // Vindo do mapa: novo registo com o nome do bar nas notas e o país, se o mapa o souber.
    function countryName(code) {
        try {
            return code ? new Intl.DisplayNames(['pt-PT'], { type: 'region' }).of(code) : '';
        } catch (e) {
            return '';
        }
    }

    function registerAt(place) {
        resetForm();
        $('beer-notes').value = 'Bebida no ' + place.name + (place.address ? ' (' + place.address + ')' : '');
        const country = place.country || countryName(place.countryCode);
        if (country) {
            $('beer-country').value = country;
        }
        location.hash = PAGE_HASH.home;
        setTimeout(openForm, 80);
        showToast('Ficha aberta para ' + place.name + '. Saúde!');
    }

    // ---------- Lista ----------

    function renderHero() {
        const stats = BeerStats.computeStats(beers);
        $('hero-total').textContent = stats.total;
        $('hero-countries').textContent = stats.countries;
        $('hero-rating').textContent = stats.total ? formatNumber(stats.avgRating, 1) : '–';

        // As últimas 5 caricas espalhadas no hero; o brilho de fundo tem a cor da mais recente.
        const recent = BeerStats.sortBeers(beers, 'date', 'desc').slice(0, 5);
        document.querySelector('.hero').style.setProperty('--glass-color', typeColor(recent.length ? recent[0].type : 'Lager'));
        $('hero-caps').innerHTML = recent.length
            ? recent.map(function (beer, i) {
                return '<span class="hero-cap" style="--slot: ' + i + '; --rot: ' + capRotation(beer.id) + 'deg">' + capHtml(beer.type) + '</span>';
            }).join('')
            : '<span class="hero-cap" style="--slot: 0; --rot: -12deg">' + capHtml('Lager', '', '?') + '</span>';
        $('stamp-num').textContent = String(stats.total).padStart(3, '0');
    }

    function render() {
        renderHero();
        renderOptions();
        renderBeerList();
        if (currentPage === 'stats') {
            renderStats();
        }
    }

    function uniqueValues(field) {
        const seen = {};
        beers.forEach(function (b) {
            if (b[field]) {
                seen[b[field]] = true;
            }
        });
        return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'pt'); });
    }

    // Sugestões de marca/país e filtro de tipo a partir dos dados existentes.
    function renderOptions() {
        const toOptions = function (values) {
            return values.map(function (v) { return '<option value="' + escapeHtml(v) + '"></option>'; }).join('');
        };
        $('brand-options').innerHTML = toOptions(uniqueValues('brand'));
        $('country-options').innerHTML = toOptions(uniqueValues('country'));

        const selected = filterType.value;
        const types = uniqueValues('type');
        filterType.innerHTML = '<option value="">Todos os tipos</option>' + types.map(function (t) {
            return '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>';
        }).join('');
        filterType.value = types.indexOf(selected) !== -1 ? selected : '';
    }

    function iconSvg(name) {
        return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
    }

    function renderBeerList() {
        const filtered = BeerStats.filterBeers(beers, { query: searchInput.value, type: filterType.value });
        const sorted = BeerStats.sortBeers(filtered, sortState.field, sortState.direction);
        const numbers = batchNumbers();

        beerListBody.innerHTML = sorted.map(function (beer, index) {
            const color = typeColor(beer.type);
            const name = escapeHtml(beer.name);
            const d = dateParts(beer.date);
            const sub = [beer.brand, beer.country].filter(Boolean).map(escapeHtml).join(' · ');
            return '<li class="entry' + (beer.id === highlightId ? ' highlight' : '') + '" data-id="' + escapeHtml(beer.id) + '"' +
                ' style="--type-color: ' + color + '; --cap-ink: ' + capInk(color) + '; --i: ' + Math.min(index, 12) + '">' +
                capHtml(beer.type, 'entry-cap') +
                '<div class="entry-main">' +
                    '<p class="entry-batch">Nº ' + escapeHtml(numbers[beer.id] || '') + '</p>' +
                    '<h3 class="entry-name">' + name + '</h3>' +
                    '<p class="entry-sub">' + sub + '</p>' +
                    '<div class="entry-tags">' +
                        '<span class="type-badge">' + escapeHtml(beer.type) + '</span>' +
                        '<span class="abv-pill">' + escapeHtml(formatNumber(beer.abv, 1)) + '% vol</span>' +
                    '</div>' +
                    (beer.notes ? '<p class="entry-notes">' + escapeHtml(beer.notes) + '</p>' : '') +
                '</div>' +
                '<div class="entry-side">' +
                    '<div class="entry-rating">' + ratingHtml(Number(beer.rating)) + '</div>' +
                    '<time class="entry-date" datetime="' + escapeHtml(beer.date) + '">' + escapeHtml(d.day + ' ' + d.month + ' ' + d.year) + '</time>' +
                '</div>' +
                '<div class="row-actions">' +
                    '<button type="button" class="icon-button" data-action="edit" aria-label="Editar ' + name + '" title="Editar">' + iconSvg('pencil') + '</button>' +
                    '<button type="button" class="icon-button danger" data-action="remove" aria-label="Remover ' + name + '" title="Remover">' + iconSvg('trash') + '</button>' +
                '</div>' +
                '</li>';
        }).join('');
        highlightId = null;

        const isFiltering = Boolean(searchInput.value.trim() || filterType.value);
        $('empty-message').classList.toggle('hidden', beers.length > 0);
        $('no-results').classList.toggle('hidden', beers.length === 0 || sorted.length > 0);
        beerListBody.classList.toggle('hidden', sorted.length === 0);
        document.querySelector('.toolbar').classList.toggle('hidden', beers.length === 0);
        $('export-button').disabled = beers.length === 0;

        let countText = '';
        if (beers.length) {
            countText = isFiltering
                ? sorted.length + ' de ' + beers.length + ' caricas'
                : beers.length + (beers.length === 1 ? ' carica na coleção' : ' caricas na coleção');
        }
        $('result-count').textContent = countText;
    }

    // O valor do menu é "campo-direção", por exemplo "rating-desc".
    function handleSort() {
        const parts = $('sort-select').value.split('-');
        sortState = { field: parts[0], direction: parts[1] };
        renderBeerList();
    }

    // ---------- Cópia de segurança ----------

    function exportBeers() {
        const blob = new Blob([JSON.stringify(beers, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'beertracker-' + todayIso() + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function importBeers(file) {
        const reader = new FileReader();
        reader.onload = function () {
            let result;
            try {
                result = BeerStats.parseBackup(String(reader.result));
            } catch (e) {
                showToast(e.message);
                return;
            }
            if (!result.beers.length) {
                showToast('O ficheiro não tem cervejas válidas.');
                return;
            }
            const message = 'Importar ' + result.beers.length + ' cervejas?' +
                (result.skipped ? ' (' + result.skipped + ' inválidas serão ignoradas)' : '') +
                '\n\nOK substitui a tua coleção; Cancelar junta-as às que já tens.';
            const replace = window.confirm(message);
            const base = replace ? [] : beers.slice();
            const ids = {};
            base.forEach(function (b) { ids[b.id] = true; });
            let id = Math.max(Date.now(), nextId());
            result.beers.forEach(function (beer) {
                if (!beer.id || ids[beer.id]) {
                    beer.id = id++;
                }
                ids[beer.id] = true;
                base.push(beer);
            });
            beers = base;
            saveBeers();
            resetForm();
            render();
            showToast(result.beers.length + ' caricas importadas.');
        };
        reader.onerror = function () { showToast('Não deu para ler o ficheiro.'); };
        reader.readAsText(file);
    }

    // ---------- Estatísticas ----------

    function renderStats() {
        const stats = BeerStats.computeStats(beers);
        const hasData = stats.total > 0;

        $('stats-empty').classList.toggle('hidden', hasData);
        $('stats-content').classList.toggle('hidden', !hasData);
        if (!hasData) {
            return;
        }

        $('total-beers').textContent = stats.total;
        $('total-countries').textContent = stats.countries;
        $('total-types').textContent = stats.types;
        $('total-brands').textContent = stats.brands;
        $('avg-rating').textContent = formatNumber(stats.avgRating, 1);
        $('avg-abv').textContent = formatNumber(stats.avgAbv, 1) + '%';
        $('top-country').textContent = stats.topCountry ? 'Onde bebes mais: ' + stats.topCountry : '';
        $('top-type').textContent = stats.topType ? 'O teu preferido: ' + stats.topType : '';
        $('best-beer').textContent = stats.best ? stats.best.name : '—';
        $('best-beer').title = stats.best ? stats.best.name : '';
        if (stats.best) {
            const d = dateParts(stats.best.date);
            $('best-beer-sub').textContent = formatNumber(stats.best.rating, 1) + ' ★ · ' + stats.best.brand + ' · ' + d.day + ' ' + d.month + ' ' + d.year;
            document.querySelector('.stat-card-wide').style.setProperty('--type-color', typeColor(stats.best.type));
        } else {
            $('best-beer-sub').textContent = '';
        }

        renderCollection(stats);
        renderCharts(stats);
    }

    const MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000];

    // Grelha com uma carica por cerveja, pela ordem em que foram bebidas, mais
    // lugares vazios até à próxima meta (5, 10, 25…).
    function renderCollection(stats) {
        const numbers = batchNumbers();
        const ordered = BeerStats.sortBeers(beers, 'date', 'asc');
        const goal = MILESTONES.find(function (m) { return m > ordered.length; }) || ordered.length;
        const caps = ordered.map(function (beer, i) {
            const label = 'Nº ' + numbers[beer.id] + ' · ' + beer.name + ' (' + beer.type + ', ' + formatNumber(beer.rating, 1) + ' estrelas)';
            return '<li class="cap-item" style="--rot: ' + capRotation(beer.id) + 'deg; --i: ' + Math.min(i, 30) + '" title="' + escapeHtml(label) + '">' +
                capHtml(beer.type) +
                '<span class="cap-num">' + escapeHtml(numbers[beer.id]) + '</span>' +
                '<span class="visually-hidden">' + escapeHtml(label) + '</span>' +
                '</li>';
        });
        const slots = [];
        for (let i = ordered.length; i < goal; i++) {
            slots.push('<li class="cap-slot" aria-hidden="true"><span>' + String(i + 1).padStart(3, '0') + '</span></li>');
        }
        $('cap-grid').innerHTML = caps.join('') + slots.join('');
        $('collection-count').textContent = stats.total + (stats.total === 1 ? ' carica' : ' caricas');
        const missing = goal - ordered.length;
        $('collection-next').textContent = missing > 0
            ? 'Faltam ' + missing + ' para as ' + goal + '.'
            : '';
        $('cap-legend').innerHTML = BeerStats.sortCounts(stats.byType).map(function (t) {
            return '<li style="--type-color: ' + typeColor(t.label) + '"><span class="legend-dot"></span>' +
                escapeHtml(t.label) + ' <span class="mono">× ' + t.count + '</span></li>';
        }).join('');
    }

    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function renderCharts(stats) {
        const chartsAvailable = typeof Chart !== 'undefined';
        $('charts-unavailable').classList.toggle('hidden', chartsAvailable);
        $('charts-container').classList.toggle('hidden', !chartsAvailable);
        if (!chartsAvailable) {
            return;
        }

        Chart.defaults.color = cssVar('--muted');
        Chart.defaults.borderColor = cssVar('--border');
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.font.size = 12;
        // Dicas com o aspeto da app (fundo de malte, cantos redondos, números em pt-PT).
        Object.assign(Chart.defaults.plugins.tooltip, {
            backgroundColor: '#1c1008',
            titleColor: '#fff6e5',
            bodyColor: '#fff6e5',
            borderColor: 'rgba(242, 162, 12, 0.4)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
            boxPadding: 4,
            titleFont: { weight: '700' }
        });
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.pointStyle = 'circle';

        const byCountry = BeerStats.sortCounts(stats.byCountry);
        const byType = BeerStats.sortCounts(stats.byType);
        // Termina no mês do registo mais recente, para o gráfico não ficar vazio com dados antigos.
        const dates = beers.map(function (b) { return String(b.date); }).sort();
        const latest = dates[dates.length - 1] || todayIso();
        const span = BeerStats.monthSpan(dates[0], latest, 6, 12);
        const months = BeerStats.countByMonth(beers, latest, span);
        $('month-range').textContent = span + ' meses até ao último registo';
        const ratingTypes = Object.keys(stats.ratingByType).sort(function (a, b) {
            return stats.ratingByType[b] - stats.ratingByType[a];
        });
        const primary = cssVar('--primary-color');

        drawChart('month', 'bar', {
            labels: months.map(function (m) { return m.label; }),
            datasets: [{ data: months.map(function (m) { return m.count; }), backgroundColor: primary, hoverBackgroundColor: cssVar('--amber-hot'), borderColor: cssVar('--line'), borderWidth: 2, borderRadius: 2, borderSkipped: false, maxBarThickness: 44 }]
        }, barOptions({ precision: 0 }));

        drawChart('country', 'doughnut', {
            labels: byCountry.map(function (c) { return c.label; }),
            datasets: [{ data: byCountry.map(function (c) { return c.count; }), backgroundColor: CHART_COLORS, borderColor: cssVar('--line'), borderWidth: 2, hoverOffset: 8 }]
        }, pieOptions());

        drawChart('type', 'pie', {
            labels: byType.map(function (c) { return c.label; }),
            datasets: [{ data: byType.map(function (c) { return c.count; }), backgroundColor: byType.map(function (c) { return typeColor(c.label); }), borderColor: cssVar('--line'), borderWidth: 2, hoverOffset: 8 }]
        }, pieOptions());

        drawChart('rating', 'bar', {
            labels: ratingTypes,
            datasets: [{
                data: ratingTypes.map(function (t) { return Number(stats.ratingByType[t].toFixed(2)); }),
                backgroundColor: ratingTypes.map(typeColor),
                borderRadius: 2, borderSkipped: false, maxBarThickness: 56, borderWidth: 2, borderColor: cssVar('--line')
            }]
        }, barOptions({ min: 0, max: 5, stepSize: 1 }));
    }

    function barOptions(ticks) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, border: { display: false } },
                y: {
                    beginAtZero: true, min: ticks.min, max: ticks.max,
                    grid: { color: cssVar('--border'), drawBorder: false },
                    ticks: { precision: ticks.precision, stepSize: ticks.stepSize, padding: 8 }
                }
            }
        };
    }

    function pieOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } } }
        };
    }

    function drawChart(name, type, data, options) {
        const chart = charts[name];
        if (chart) {
            chart.data = data;
            chart.options = options;
            chart.update();
            return;
        }
        charts[name] = new Chart($(name + '-chart').getContext('2d'), { type: type, data: data, options: options });
    }

    function destroyCharts() {
        Object.keys(charts).forEach(function (name) { charts[name].destroy(); });
        charts = {};
    }

    // ---------- Navegação ----------

    function pageFromHash() {
        const page = Object.keys(PAGE_HASH).find(function (key) { return PAGE_HASH[key] === location.hash; });
        return page || 'home';
    }

    function setActivePage(page) {
        currentPage = page;
        document.querySelectorAll('.nav-item').forEach(function (link) {
            if (link.dataset.page === page) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
        Object.keys(pages).forEach(function (key) {
            pages[key].classList.toggle('hidden', key !== page);
        });
        document.title = PAGE_TITLES[page] + ' · BeerTracker';
        if (page === 'stats') {
            renderStats();
        } else if (page === 'map' && window.BeerMap) {
            BeerMap.show();
        }
    }

    // ---------- Tema ----------

    function isDarkTheme() {
        const explicit = document.documentElement.dataset.theme;
        if (explicit) {
            return explicit === 'dark';
        }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function updateThemeButton() {
        $('theme-toggle').setAttribute('aria-label', isDarkTheme() ? 'Mudar para tema claro' : 'Mudar para tema escuro');
    }

    function onThemeChanged() {
        updateThemeButton();
        destroyCharts();
        if (currentPage === 'stats') {
            renderStats();
        }
    }

    function toggleTheme() {
        const next = isDarkTheme() ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch (e) { /* sem armazenamento */ }
        onThemeChanged();
    }

    // ---------- Eventos ----------

    function init() {
        loadBeers();
        resetForm();

        form.addEventListener('submit', handleSubmit);
        initSuggestions();
        $('beer-rating').addEventListener('input', updateRatingOutput);
        $('cancel-edit').addEventListener('click', resetForm);
        initRatingStars();
        $('hero-cta').addEventListener('click', function (event) {
            event.preventDefault();
            openForm();
        });
        $('add-fab').addEventListener('click', openForm);
        $('close-form').addEventListener('click', function () { closeForm(); });
        $('sheet-backdrop').addEventListener('click', function () { closeForm(); });
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') {
                return;
            }
            if ($('beer-id').value && form.contains(document.activeElement)) {
                resetForm();
            }
            closeForm();
        });
        // Passar de telemóvel para ecrã largo com a folha aberta: fecha-a.
        const onLayoutChange = function () {
            if (!mobileQuery.matches) {
                closeForm(false);
            }
        };
        if (mobileQuery.addEventListener) {
            mobileQuery.addEventListener('change', onLayoutChange);
        }
        // Limpa o erro de um campo assim que o utilizador o corrige.
        form.addEventListener('input', function (event) {
            const field = event.target.id.replace('beer-', '');
            const errorEl = $('error-' + field);
            if (errorEl && errorEl.textContent) {
                errorEl.textContent = '';
                event.target.removeAttribute('aria-invalid');
            }
        });

        beerListBody.addEventListener('click', function (event) {
            const button = event.target.closest('[data-action]');
            if (!button) {
                return;
            }
            const id = Number(button.closest('[data-id]').dataset.id);
            if (button.dataset.action === 'edit') {
                startEdit(id);
            } else if (button.dataset.action === 'remove') {
                removeBeer(id);
            }
        });

        searchInput.addEventListener('input', renderBeerList);
        filterType.addEventListener('change', renderBeerList);
        $('sort-select').addEventListener('change', handleSort);

        $('export-button').addEventListener('click', exportBeers);
        $('import-file').addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (file) {
                importBeers(file);
            }
            event.target.value = '';
        });

        window.addEventListener('hashchange', function () {
            setActivePage(pageFromHash());
            window.scrollTo(0, 0);
        });

        $('theme-toggle').addEventListener('click', toggleTheme);
        if (window.matchMedia) {
            const media = window.matchMedia('(prefers-color-scheme: dark)');
            const listener = function () {
                if (!document.documentElement.dataset.theme) {
                    onThemeChanged();
                }
            };
            if (media.addEventListener) {
                media.addEventListener('change', listener);
            }
        }
        updateThemeButton();

        // "Registar uma cerveja aqui" no mapa: abre o formulário com o local nas notas.
        window.addEventListener('beertracker:register-at', function (event) {
            registerAt(event.detail);
        });

        // Mantém os dados sincronizados entre separadores abertos.
        window.addEventListener('storage', function (event) {
            if (event.key === STORAGE_KEY) {
                loadBeers();
                render();
            }
        });

        render();
        setActivePage(pageFromHash());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
