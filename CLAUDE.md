# BeerTracker

Aplicação onde o utilizador regista as cervejas que bebe (nome, marca, tipo, país onde a bebeu, teor alcoólico, avaliação, data, notas) e vê estatísticas sobre elas.

Estado atual: protótipo web em HTML, CSS e JavaScript puros, para testes. O objetivo final é lançar em iOS e Android; a tecnologia para isso ainda não está decidida.

## Comandos

- `npm start` — serve a app em http://localhost:8000 (servidor em `tools/serve.js`, sem dependências). Também funciona abrindo `index.html` diretamente no browser.
- `npm test` — testes da lógica das estatísticas (`node --test`).

Não há passo de build nem dependências npm.

## Automações

- Hook do Claude Code (`.claude/settings.json`): depois de editar `js/*.js` ou `tests/*.js`, corre `npm test`; se falhar, o erro volta ao Claude.
- GitHub Actions (`.github/workflows/deploy.yml`): `npm test` em cada push e pull request; no ramo `main`, se passar, publica `index.html`, `css/` e `js/` no GitHub Pages.

## Estrutura

- `index.html` — as duas páginas (Início e Estatísticas) no mesmo documento; a navegação mostra/esconde `#home-page` e `#stats-page`.
- `css/styles.css` — todos os estilos; cores em variáveis no `:root`.
- `js/stats.js` — lógica pura: estatísticas (`computeStats`, `countByMonth`…), validação (`validateBeer`), pesquisa/ordenação (`filterBeers`, `sortBeers`) e importação (`parseBackup`). Sem DOM; exposto como `window.BeerStats` no browser e via `require` no Node.
- `js/app.js` — dados (localStorage), renderização e eventos: adicionar/editar/remover (com anular), pesquisa, filtro, ordenação, exportar/importar JSON, tema claro/escuro e navegação por hash (`#inicio`, `#estatisticas`).
- `tests/stats.test.js` — testes de `js/stats.js`.

## Convenções

- Texto da interface e comentários em português de Portugal.
- JavaScript puro, sem frameworks nem bundler. Os ficheiros são carregados com `<script>` normais (não ES modules), para a app funcionar também aberta via `file://`.
- Lógica nova que não dependa do DOM vai para `js/stats.js` (ou outro módulo puro) com testes.
- Tudo o que vem do utilizador passa por `escapeHtml` antes de entrar em `innerHTML`.
- Datas guardadas como `AAAA-MM-DD` (string). Não converter com `new Date()` para mostrar: usar `formatDate`.

## Dados

- Tema escolhido em `localStorage`, chave `theme` (`light`/`dark`; sem chave segue o sistema).
- Guardados em `localStorage`, chave `beers`: array de `{ id, name, brand, type, country, abv, rating, date, notes }`.
- As 5 cervejas de exemplo (`SAMPLE_BEERS` em `js/app.js`) só são carregadas quando a chave ainda não existe. Para as repor: apagar a chave `beers` no browser e recarregar.
- Os gráficos usam Chart.js 3.9.1 carregado por CDN; sem internet, a página mostra um aviso em vez dos gráficos.
