# BeerTracker

Aplicação onde o utilizador regista as cervejas que bebe (nome, marca, tipo, país onde a bebeu, teor alcoólico, avaliação, data, notas) e vê estatísticas sobre elas.

Estado atual: protótipo web em HTML, CSS e JavaScript puros, para testes. O objetivo final é lançar em iOS e Android; a tecnologia para isso ainda não está decidida.

## Comandos

- `npm start` — serve a app em http://localhost:8000 (servidor em `tools/serve.js`, sem dependências). Também funciona abrindo `index.html` diretamente no browser.
- `npm test` — testes da lógica pura (`node --test`, ficheiros em `tests/`).

Não há passo de build nem dependências npm.

## Automações

- Hook do Claude Code (`.claude/settings.json`): depois de editar `js/*.js` ou `tests/*.js`, corre `npm test`; se falhar, o erro volta ao Claude.
- GitHub Actions (`.github/workflows/deploy.yml`): `npm test` em cada push e pull request; no ramo `main`, se passar, publica `index.html`, `css/` e `js/` no GitHub Pages.

## Estrutura

- `index.html` — as três páginas (Início, Estatísticas e Mapa) no mesmo documento; a navegação mostra/esconde `#home-page`, `#stats-page` e `#map-page`.
- `css/styles.css` — todos os estilos; cores em variáveis no `:root`.
- `js/stats.js` — lógica pura: estatísticas (`computeStats`, `countByMonth`…), validação (`validateBeer`), pesquisa/ordenação (`filterBeers`, `sortBeers`) e importação (`parseBackup`). Sem DOM; exposto como `window.BeerStats` no browser e via `require` no Node.
- `js/catalog.js` — catálogo de cervejas conhecidas (`CATALOG`: nome, marca, tipo, teor, país de origem) e pesquisa (`searchCatalog`, `buildSuggestions`, que junta as cervejas já registadas). Puro; `window.BeerCatalog`. Os tipos têm de ser os do `<select>` do formulário (há um teste).
- `js/places.js` — lógica pura do mapa: pesquisa ao Overpass (`buildOverpassQuery`, `parsePlaces`), leitura do Nominatim (`parseNominatimPlaces`), junção (`mergePlaces`), distâncias, horários. `window.BeerPlaces`.
- `js/map-page.js` — página do mapa (Leaflet 1.9.4 por CDN, carregado só ao abrir a página): servidores Overpass alternativos, pesquisa de sítios no Nominatim, localização, filtros e "Registar uma cerveja aqui" (evento `beertracker:register-at`, tratado em `app.js`). `window.BeerMap.show()`.
- `js/app.js` — dados (localStorage), renderização e eventos: adicionar/editar/remover (com anular), sugestões no campo do nome (combobox ARIA), pesquisa, filtro, ordenação, exportar/importar JSON, tema claro/escuro e navegação por hash (`#inicio`, `#estatisticas`, `#mapa`).
- `tests/` — testes de `stats.js`, `catalog.js` e `places.js`.
- `docs/brand-guidelines.md` — guia de marca: conceito, voz, cores, letras, motivos, componentes e movimento.

## Convenções

- Texto da interface e comentários em português de Portugal.
- JavaScript puro, sem frameworks nem bundler. Os ficheiros são carregados com `<script>` normais (não ES modules), para a app funcionar também aberta via `file://`.
- Lógica nova que não dependa do DOM vai para `js/stats.js` (ou outro módulo puro) com testes.
- Tudo o que vem do utilizador passa por `escapeHtml` antes de entrar em `innerHTML`.
- Ícones: só SVG do conjunto no topo do `index.html` (`<svg class="i"><use href="#i-nome"/></svg>`, traço ao estilo Lucide). Nada de emojis como ícones.
- Identidade e voz: seguir **`docs/brand-guidelines.md`** (fonte única). Resumo: "coleção de caricas" e caderno de provas; rótulos com contorno a tinta (`--line`), sombra dura (`--shadow`), cantos de 6–8px e filete tracejado; botões carimbados em maiúsculas condensadas; letras Bricolage Grotesque condensada + Figtree + Space Mono; carica (`#i-cap`, `capHtml()` em `app.js`) no logótipo, lista, hero, coleção, botão + e alfinetes do mapa. Textos tratam por **tu**, curtos, voz de taberna de bairro. A camada "Linguagem de rótulo" está no fim de `css/styles.css`.
- No telemóvel (≤720px) a navegação é uma barra fixa em baixo e o formulário abre como folha a partir do botão "+" (`openForm`/`closeForm` em `app.js`); não pôr `backdrop-filter`, `transform` nem `filter` em antepassados de elementos `position: fixed`, nem mudar o `position` de `.beer-form` fora das regras de sticky/fixed.
- Datas guardadas como `AAAA-MM-DD` (string). Não converter com `new Date()` para mostrar: usar `formatDate`.

## Dados

- Tema escolhido em `localStorage`, chave `theme` (`light`/`dark`; sem chave segue o sistema).
- Guardados em `localStorage`, chave `beers`: array de `{ id, name, brand, type, country, abv, rating, date, notes }`.
- As 5 cervejas de exemplo (`SAMPLE_BEERS` em `js/app.js`) só são carregadas quando a chave ainda não existe. Para as repor: apagar a chave `beers` no browser e recarregar.
- Os gráficos usam Chart.js 3.9.1 carregado por CDN; sem internet, a página mostra um aviso em vez dos gráficos.
- Mapa: azulejos e locais do OpenStreetMap, sem chave. Duas fontes em paralelo: o Nominatim (`amenity=pub|bar|biergarten`, ~0,5 s, máx. 40 por tipo, pedidos espaçados de 1,1 s pela fila `nominatimFetch`) dá a primeira vista; o Overpass (vários servidores em `OVERPASS_URLS`, muitas vezes 20–30 s ou ocupado) completa com cervejarias e horários. Se o Overpass falhar, ficam os resultados do Nominatim ("lista parcial"). Cache da última zona completa em `localStorage`, chave `placesCache` (1 dia); a última vista do mapa em `mapView`. Para lançar a sério, usar um servidor próprio ou pago.
