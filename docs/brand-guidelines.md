# BeerTracker · Guia de marca

Fonte única para o aspeto e a voz da app. Antes de mudar estilos ou textos, ler isto.

## Conceito: a coleção de caricas

Cada cerveja que bebes é uma carica que entra na tua coleção. A app é o teu **caderno de provas** de taberna: rótulos impressos, carimbos, números de lote, papel creme. Nada de painel de software genérico.

Perguntas de controlo, para cada ecrã:
1. Se tapasse o logótipo, ainda se reconhecia a app? (carica, rótulo, letra condensada)
2. Isto podia estar noutro site de IA qualquer? Se sim, falta rótulo.

## Voz: taberna de bairro

Próxima, curta, sabe de cerveja mas não é snob. Trata por **tu**. Português de Portugal.

| Traço | Faz | Não faz |
|---|---|---|
| Próxima | "Abre a primeira." | "Utilize o formulário para adicionar." |
| Curta | "Falta o nome." | "Por favor, indique o nome da cerveja." |
| Conhecedora | "5,2% VOL", "Nº 006", "ficha de prova" | Jargão de sommelier, "experiência", "jornada" |
| Bem-disposta (com moderação) | "Saúde! Entrou na coleção." | Piadas em mensagens de erro |

Tom por contexto: erros são diretos e dizem como resolver; sucesso pode brindar ("Saúde!"); avisos de dados (localStorage, internet) são sóbrios.

Frases proibidas: "Cada X conta uma história", "Descobre o teu potencial", "experiência única", "fácil e intuitivo".

## Cores

| Nome | Variável | Uso |
|---|---|---|
| Malte | `--malt` #1c1008 | Cabeçalho, hero, rótulos escuros, sombra dura |
| Âmbar | `--amber` #f2a20c | Ações, destaques, carica da marca |
| Vermelho de rótulo | `--label-red` #c4412b | Números de lote, carimbos, selo |
| Papel | `--bg` #f3ead8 + `--paper` (grão) | Fundo |
| Tinta | `--line` | Contornos de rótulo (escuro no claro, castanho no escuro) |

Cada tipo de cerveja tem a cor do copo (`TYPE_COLORS` em `app.js`): é a cor da carica.

## Letras

- **Bricolage Grotesque** condensada (`--font-display`, `--display-tight`): títulos, números grandes, botões (maiúsculas), abreviaturas nas caricas.
- **Space Mono** (`--font-mono`): "dados de rótulo": teor, datas, `Nº`, contagens, etiquetas de campos, eyebrows. Sempre em maiúsculas pequenas.
- **Figtree** (`--font-body`): texto corrido e campos.

Nunca Inter, Fraunces ou outros pares neutros "de template".

## Motivos

- **Carica** (`#i-cap`): logótipo, cada cerveja, botão +, alfinetes do mapa, coleção nas Estatísticas, hero (as tuas últimas caricas).
- **Rótulo**: contorno de 2px em tinta, cantos pouco arredondados (6px), **sombra dura** deslocada (sem desfoque) e, nos rótulos de destaque, um **filete tracejado interior**.
- **Carimbo / selo**: texto em círculo, vermelho de rótulo ou âmbar.
- **Número de lote**: `Nº 006` pela ordem em que se bebeu.

## Componentes

- **Botões**: retangulares (raio 8px), letra condensada em maiúsculas, sombra dura; ao carregar descem para a sombra. Nada de comprimidos arredondados.
- **Cartões**: rótulos (ver acima). Sem sombras difusas grandes.
- **Campos da ficha de prova**: linha por baixo, sem caixa; etiqueta em Space Mono.
- **Filtros (chips)**: etiquetas retangulares com contorno; ativa = malte cheio.
- **Ícones**: só SVG de traço do conjunto em `index.html`. Nada de emojis.

## Movimento

Pouco e com intenção: caricas caem e rodam ao entrar (uma vez), rodam ao passar o rato; botões "carimbam" ao carregar. Tudo desliga com `prefers-reduced-motion`.
