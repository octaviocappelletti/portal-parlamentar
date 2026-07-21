# UX · Capivara Parlamentar — Registro de Implementação

> Documento gerado ao fim da sessão de implementação do design system e das três
> rotas principais. Serve como referência para qualquer dev que retomar o trabalho.

---

## 1. Fonte do design

| Arquivo | Papel |
|---|---|
| `design_handoff_capivara/README.md` | Tokens, mapeamento de telas→rotas, instruções técnicas |
| `design_handoff_capivara/Capivara Parlamentar.dc.html` | Protótipo hi-fi com seções `#1a`, `#2a`, `#2b` |

**Identidade aprovada:** `1a` — gov.br clássico (azul predominante, verde e amarelo em detalhes).  
**Descartadas:** `1b` (dashboard didático) e `1c` — ignorar.

---

## 2. Design tokens (`web/tailwind.config.ts`)

### Cores

| Token Tailwind | Hex | Uso |
|---|---|---|
| `brand-blue` | `#1351B4` | Botões primários, links ativos, barras principais |
| `brand-blue-dark` | `#071d41` | GovBar, footer, valores KPI fortes |
| `brand-green` | `#168821` | Deltas positivos, segunda categoria de gasto |
| `brand-yellow` | `#FFCD07` | Borda-assinatura do header (âncora visual da marca) |
| `danger` | `#c0392b` | 1º lugar no ranking, acima da média |
| `blue-bg` | `#e8f0fb` | Fundo de badges info, avatares |
| `green-bg` | `#e7f4ea` | Badge "Aprovado" |
| `yellow-bg` | `#fdf3cd` | Badge "Em tramitação" |
| `yellow-text` | `#8a6d00` | Texto em `yellow-bg` |
| `text-strong` | `#1c2733` | Títulos e labels primários |
| `text-body` | `#54606e` | Corpo de texto, subtítulos |
| `text-muted` | `#7a8798` | Metadados, datas, breadcrumb inativo |
| `border-base` | `#e4e9f0` | Bordas de cards e divisores |
| `border-input` | `#d3dae4` | Bordas de inputs e selects |
| `track` | `#eef2f7` | Trilho de barra de progresso |
| `surface-alt` | `#f4f7fc` | Seções suaves, cabeçalho de tabela, breadcrumb bg |

### Tipografia

- **Família:** Raleway (Google Fonts via `next/font/google`, variável `--font-raleway`)
- **Pesos carregados:** 400 / 500 / 600 / 700 / 800 / 900
- **Configuração:** `font-sans` no Tailwind aponta para `var(--font-raleway)`
- **Escala de referência:**

| Tamanho | Peso | Uso |
|---|---|---|
| 42px / 800 | extrabold | H1 hero |
| 30px / 800 | extrabold | H1 de página |
| 26px / 800 | extrabold | Valores KPI |
| 22px / 800 | extrabold | H2 de seção |
| 19px / 800 | extrabold | Nome no header |
| 18px / 800 | extrabold | H3 no detalhe |
| 16px / 700 | bold | Cards "Como funciona" |
| 14px / 700 | bold | Nomes na tabela, nav ativo |
| 13px / 600 | semibold | Labels, filtros, metadados |
| 12px / 700 | bold | GovBar, badges, eyebrows |

---

## 3. Componentes compartilhados

Todos ficam em `web/src/components/`.

### `GovBar.tsx` — Barra gov.br
- Fundo `brand-blue-dark`, texto `#c9d4e8`
- Esquerda: "gov.br" (bold branco) + subtítulo opaco
- Direita: links "Acessibilidade · Alto contraste · Mapa do site"
- **Renderizado no `layout.tsx`** — presente em todas as páginas

### `SiteHeader.tsx` (client component)
- Borda inferior `border-b-[3px] border-brand-yellow` — assinatura visual obrigatória em todas as páginas
- Logo "CP" (44×44 `rounded-xl bg-brand-blue`)
- Nome + tagline "TRANSPARÊNCIA DO CONGRESSO NACIONAL"
- Nav: Deputados / Senadores / Gastos / Proposições / Sobre
- Active state via `usePathname()` — item ativo recebe `text-brand-blue`
- **Renderizado no `layout.tsx`**

### `SiteFooter.tsx`
- Fundo `brand-blue-dark`, logo mini + nome à esquerda
- Créditos à direita: "Dados: Câmara · Senado · Portal da Transparência"
- **Renderizado no `layout.tsx`**

### `SearchBar.tsx` (client component)
- Input controlado com `useState`
- Submit navega para `/camara?q=...` via `useRouter`
- Estilo: border `2px solid brand-blue`, `rounded-xl`, sombra azul suave
- Botão "Buscar" em `brand-blue` com hover escuro

### `GastosChart.tsx` (client component — Recharts)
- `BarChart` layout `vertical` (barras horizontais)
- Prop: `data: { label: string; total: number; cor: string }[]`
- `background={{ fill: "#eef2f7", radius: 4 }}` simula o "trilho" atrás de cada barra
- `Cell` por barra para cores individuais (azul/verde/amarelo por posição)
- Tooltip: valor formatado em BRL (`Intl.NumberFormat pt-BR`)
- Altura dinâmica: `data.length × 48px` (mínimo 120px)
- Exporta também o tipo `GastoItem` para uso nas páginas

---

## 4. Layout raiz (`web/src/app/layout.tsx`)

```
<body>
  <GovBar />        ← barra gov.br
  <SiteHeader />    ← header com borda amarela
  <main>
    {children}      ← conteúdo da rota
  </main>
  <SiteFooter />    ← footer azul escuro
</body>
```

- `flex flex-col min-h-screen` no body garante footer grudado ao fundo em páginas curtas
- `<main class="flex-1">` expande para preencher o espaço disponível
- Metadata global: title template `"%s · Capivara Parlamentar"`

---

## 5. Rotas implementadas

### 5.1 Home — `/` (`app/page.tsx`)

**Seções (top → bottom):**

| Seção | Dados | Status |
|---|---|---|
| Hero + SearchBar | — | estático |
| Stats strip (4 cols) | Supabase real | **conectado** |
| Como funciona (3 cards) | — | estático |
| Gastos por categoria | Mock (`MOCK_GASTOS_HOME`) + Recharts | mock com Recharts |

**Stats conectados ao Supabase:**
- Deputados federais → `parlamentar` COUNT onde `casa=camara AND situacao='Exercício'`
- Senadores → `parlamentar` COUNT onde `casa=senado`
- Em verbas → `despesa_totais` view (`SUM(valor_liquido)`)
- Proposições → `proposicao` COUNT
- Formatação compacta via `Intl.NumberFormat({ notation: "compact" })` → "512", "R$ 1,2 bi"
- Fallback: se Supabase falhar, exibe valores mock plausíveis

**Gastos (mock + Recharts):**  
O bloco exibe `MOCK_GASTOS_HOME` no `GastosChart`. Para conectar dados reais, é preciso uma view no banco que some `valor_liquido` por `natureza` para todos os parlamentares no ano corrente. Criar a view `despesa_media_categoria` e trocar o mock.

**`revalidate = 3600`** — ISR 1 hora.

---

### 5.2 Diretório de parlamentares — `/[casa]` (`app/[casa]/page.tsx`) — tela 3a

**Parâmetros de rota:** `casa` = `"camara"` | `"senado"`  
**SearchParams:** `q`, `uf`, `partido`, `sort`, `mostrar`

**Seções:**

| Seção | Dados | Status |
|---|---|---|
| Breadcrumb | — | estático |
| Título + subtítulo | dinâmico por casa | — |
| Toolbar (toggle + busca + selects) | partidos dinâmicos do banco | **conectado** |
| Chips de filtros ativos | searchParams | — |
| Grade 3 colunas de `ParlamentarCard` | Supabase real + gastos | **conectado** |
| Botão "Carregar mais" | Link para `?mostrar=N+24` | **conectado** |

**Queries Supabase:**
1. `parlamentar` com filtros + `range(0, mostrar-1)` + `count: "exact"`
2. `despesa_resumo_ano` para os IDs desta página, filtrado por `ano`
3. `parlamentar` distinto para popular `<select>` de partidos

**Toolbar:**
- Toggle Câmara/Senado: dois `<Link>` que preservam todos os filtros ao trocar de casa
- Busca + UF + Partido + Ordenar: `<form method="GET">` — submit atualiza page via SSR
- Opções de ordenação: Nome A-Z (DB), Maior gasto (JS), Menor gasto (JS)

**"Carregar mais" (paginação incremental):**
- `mostrar` searchParam (padrão 24, incremento 24, máx 200)
- Cada clique navega para `?mostrar=N+24` — SSR carrega mais itens do início
- Ao aplicar filtros, `mostrar` reseta para 24 (comportamento esperado)
- Exibe "Todos os resultados carregados" quando `mostrar >= total`

**Chips de filtros ativos:**
- Renderizados server-side a partir dos searchParams
- Cada ✕ é um `<Link>` que remove aquele param da URL
- Contagem de resultados alinhada à direita com `ml-auto`

**`ParlamentarCard.tsx`** (componente novo):
- Props: `nome`, `partido`, `uf`, `gasto2025`, `mediaGasto`, `situacao`, `iniciais`, `href`
- Faixa de 6px no topo colorida por status: verde ("Exercício"), cinza ("Licenciado"), azul (padrão)
- Avatar 56×56 `rounded-xl` com cores do avatar seguindo o status
- Mini-stats: "Gasto 2025" (vermelho se `gasto > mediaGasto`) e "Presença N/D"
- Badge de status no rodapé com cor derivada da faixa
- Card inteiro é um `<Link href={href}>` com `hover:shadow-md hover:-translate-y-px`

**`revalidate = 86400`** — ISR 24 horas.

---

### 5.3 Ranking de gastos — `/gastos` (`app/gastos/page.tsx`) — tela 2b

**SearchParams:** `casa`, `q`, `uf`, `partido`, `ano`, `pagina`

**Seções:**

| Seção | Dados | Status |
|---|---|---|
| Breadcrumb | — | estático |
| Título + subtítulo | dinâmico por casa/ano | — |
| Toggle Câmara/Senado + filtros (form GET) | partidos dinâmicos do banco | **conectado** |
| Tabela 5 colunas | Supabase real + mini-barra | **conectado** |
| Paginação numerada | links reais com query params | **conectado** |

**Diferença em relação ao `/[casa]`:** ordenação é sempre por gasto DESC (ranking); casa é controlada por `?casa=camara|senado` (query param) em vez de segmento de rota; paginação numerada em vez de "Carregar mais".

**Tabela:**
- Grid `56px 2.4fr 1fr 1.6fr 90px`
- 1º colocado na página: fundo `surface-alt`, avatar `bg-brand-blue text-white`, posição em `text-danger`
- Mini-barra: trilho `bg-track`, preenchimento proporcional ao maior gasto da página
- Cor da barra: 1º → `danger`, ≤25% → `brand-blue`, demais → `brand-green`
- "Ver →" linka para `/[casa]/[id_externo]`

**Toggle Câmara/Senado:** Links que preservam `q`, `uf`, `partido`, `ano` ao trocar e resetam `pagina=1`.  
**Casa no form submit:** `<input type="hidden" name="casa" value={casa}>` garante que o form preserve a casa ao aplicar filtros.

**Navegação:**
- "Ver ranking completo →" na home → `/gastos`
- "Gastos" no nav → `/gastos`

**`revalidate = 86400`** — ISR 24 horas.

---

### 5.4 Detalhe — `/[casa]/[id]` (`app/[casa]/[id]/page.tsx`)

**Parâmetros de rota:** `casa`, `id` (= `id_externo` do parlamentar)

**Seções:**

| Seção | Dados | Status |
|---|---|---|
| Breadcrumb | real (nome do parlamentar) | **conectado** |
| Header do perfil | real (nome, partido, uf, situacao) | **conectado** |
| Chips de comissões | — | não implementado |
| Tabs (5 abas) | visual only | estático |
| KPIs (4 células) | parcialmente real | ver tabela abaixo |
| Gastos por categoria | Supabase + Recharts | **conectado** |
| Proposições recentes | Supabase (3 mais recentes) | **conectado** |

**KPIs — status por campo:**

| KPI | Dado | Fonte |
|---|---|---|
| Gasto em 2025 | real | `despesa_resumo_ano WHERE parlamentar_id=X AND ano=2025` |
| Presença | N/D | tabela `presenca` não populada (§6.17) |
| Proposições | real | `proposicao` COUNT por parlamentar |
| Ranking de gastos | — | requer view de ranking global |

**Gastos por categoria (Recharts):**
- Query: `despesa WHERE parlamentar_id=X AND ano=2025` (natureza + valor_liquido)
- GROUP BY `natureza` em JS → top 5 categorias ordenadas por valor DESC
- Cores: posições 1–2 = `#1351B4`, 3–4 = `#168821`, 5 = `#FFCD07`
- Exibe `GastosChart`; se sem dados → mensagem "Sem dados de despesa disponíveis para 2025"

**Proposições recentes:**
- Query: `proposicao WHERE parlamentar_id=X ORDER BY data_apresentacao DESC LIMIT 3`
- Status mapeado: `aprovada=true` → "Aprovado"; regex `/arquiv/i` → "Arquivado"; resto → "Em tramitação"
- Badge colorido por status via `STATUS_BADGE` map

**generateMetadata:** consulta nome do parlamentar no Supabase para title dinâmico.  
**notFound():** chamado se `casa` inválida ou `id_externo` não encontrado.  
**`revalidate = 3600`** — ISR 1 hora.

---

### 5.5 Proposições — `/proposicoes` (`app/proposicoes/page.tsx`)

**SearchParams:** `q`, `status`, `tipo`, `ano`, `casa`, `pagina`

**Seções:**

| Seção | Dados | Status |
|---|---|---|
| Breadcrumb | — | estático |
| Título + subtítulo | — | estático |
| Toolbar de filtros (form GET) | — | estático |
| Chips de filtros ativos + contagem | searchParams | — |
| Lista de cards de proposição | Supabase real (2 queries) | **conectado** |
| Paginação numerada | links reais | **conectado** |

**Filtros disponíveis:**
- `q` — busca ilike na ementa
- `status` — `"tramitacao"` | `"aprovadas"` | `"arquivadas"` (vazio = todos)
- `tipo` — PL / PEC / PLS / PDL / PLN / PLC / PLP / MPV (lista fixa)
- `ano` — 2025 a 2020
- `casa` — `"camara"` | `"senado"` (vazio = ambas)

**Queries Supabase (2 etapas — evita timeout):**
1. `proposicao` com filtros + `count: "planned"` (estimativa via EXPLAIN — evita full table scan) + `.range(offset, offset+19)`
2. `parlamentar` pelos IDs únicos da página → merge em JS

> **Por que 2 queries?** O join via PostgREST (`parlamentar:parlamentar_id(...)`) em uma tabela de ~88k rows sem filtro obrigatório causava timeout no Supabase Free. Separar as queries mantém ambas rápidas.

**Mapeamento de status:**
- `aprovada=true` → "Aprovado" (`bg-green-bg text-brand-green`)
- `regex /arquiv/i` na situacao → "Arquivado" (`bg-surface-alt text-text-body`)
- demais → "Em tramitação" (`bg-yellow-bg text-yellow-text`)

**Filtro "Em tramitação" no banco:**
```tsx
query.eq("aprovada", false).or("situacao.is.null,situacao.not.ilike.%arquiv%")
```
O `.or()` inclui proposições com `situacao = null` (NULL NOT ILIKE retorna NULL no PostgreSQL, excluindo a linha sem o or).

**Card de proposição:**
- Badge status + identificação (`PL 1234/2025`) + data à direita
- Ementa truncada com `line-clamp-2`
- Mini-card do autor à direita: avatar com iniciais + nome (2 primeiros tokens) + partido · UF
- Mini-card é um `<Link>` para `/[casa]/[id_externo]` do parlamentar

**Restrição de Server Component:** event handlers (ex.: `onClick`) não podem ser usados em JSX de Server Components — causam erro de serialização em runtime. Remover qualquer handler em componentes server-rendered.

**Navegação:**
- "Proposições" no nav → `/proposicoes`
- "PLs em tramitação" na hero da home → `/proposicoes?status=tramitacao`

**`revalidate = 3600`** — ISR 1 hora.

---

## 6. Dados mock (`web/src/lib/mock.ts`)

| Exportação | Usado em | Substituir por |
|---|---|---|
| `MOCK_PARLAMENTARES` | removido das rotas principais | — |
| `MOCK_DETALHE` | removido das rotas principais | — |
| `MOCK_STATS` | removido da home | — |
| `MOCK_GASTOS_HOME` | Home — bloco de gastos | view `despesa_media_categoria` |

> Os mocks de parlamentares e detalhe foram substituídos por dados reais do Supabase.
> `MOCK_GASTOS_HOME` permanece ativo enquanto não houver view de agregação no banco.

---

## 7. Regras visuais que devem ser mantidas em novas páginas

1. **Borda amarela no header** (`border-b-[3px] border-brand-yellow`) é obrigatória — âncora da marca.
2. **Max-width `1180px` com `mx-auto px-8`** em todas as seções de conteúdo.
3. **GovBar + SiteHeader + SiteFooter** já estão no layout raiz — não replicar.
4. **Breadcrumb** sempre sobre fundo `bg-surface-alt border-b border-border-base`.
5. **Avatar sem foto:** initials extraídas via `iniciais(nome)` = primeira letra do primeiro + último nome, uppercase.
6. **Seções alternadas:** hero/gastos → `bg-white`; como-funciona/breadcrumb → `bg-surface-alt`.
7. **Responsivo:** grids 4-col viram 2-col em `sm:`, tabela colapsa para cards em mobile (ainda não implementado — ver §8).

---

## 8. Pendências e próximos passos

### Dados
- [ ] View `despesa_media_categoria` (SUM por natureza de todos os parlamentares para o ano corrente) → conectar ao gráfico da Home
- [ ] View `parlamentar_ranking_ano` (rank global por gasto) → preencher KPI "Ranking de gastos" e ordenar lista globalmente
- [ ] Tabela `presenca` populada → KPI "Presença" no detalhe

### Rotas não implementadas
- [ ] `/[casa]/[id]/despesas/[despesaId]` — detalhe da despesa (derivar do card de despesa)
- [ ] `/[casa]/[id]/projetos/[proposicaoId]` — íntegra da proposição
- [ ] `/fornecedor/[cnpj]` — página do fornecedor (reusar layout de detalhe + tabela da lista)
- [ ] `/sobre` — página institucional (nav aponta para cá, retorna 404)

### Rotas implementadas (esta sessão)
- [x] `/[casa]` — reescrito como grade de cards (tela 3a) com `ParlamentarCard`
- [x] `/gastos` — novo, tabela de ranking (tela 2b) com toggle de casa via query param
- [x] `/proposicoes` — novo, lista de proposições com filtros completos

### UX pendente
- [ ] Comissões no perfil do parlamentar (não há campo na tabela atual — adicionar à ingestão ou usar campo livre)
- [ ] Tabs do detalhe com conteúdo real (Gastos, Proposições, Votações, Patrimônio)
- [ ] Responsivo mobile: tabela `/[casa]` → cards empilhados; nav → hambúrguer
- [ ] Loading skeletons com trilho `bg-track` (enquanto ISR revalida)
- [ ] Botão "Criar alerta" → modal/auth Supabase

### Recharts (Home)
- [ ] Substituir `MOCK_GASTOS_HOME` por query real quando view de agregação estiver disponível
- [ ] Considerar `BarChart` com tooltip de mês para série temporal (fase posterior)

---

## 9. Arquivos modificados/criados

```
web/
├── tailwind.config.ts              ← tokens de cor + font-sans → Raleway
├── src/
│   ├── app/
│   │   ├── globals.css             ← body bg-white, badges com tokens, btn-primary
│   │   ├── layout.tsx              ← Raleway font, GovBar, SiteHeader, SiteFooter
│   │   ├── page.tsx                ← Home (tela 1a) — stats Supabase + Recharts
│   │   │                              links: "Ver ranking" → /gastos, "PLs" → /proposicoes?status=tramitacao
│   │   ├── [casa]/
│   │   │   ├── page.tsx            ← Diretório (tela 3a) — grade de ParlamentarCard + Carregar mais
│   │   │   └── [id]/
│   │   │       └── page.tsx        ← Detalhe (tela 2a) — Supabase + Recharts
│   │   ├── gastos/
│   │   │   └── page.tsx            ← NEW — Ranking (tela 2b) — tabela + toggle casa + paginação
│   │   └── proposicoes/
│   │       └── page.tsx            ← NEW — Proposições — filtros completos + 2-query pattern
│   ├── components/
│   │   ├── GovBar.tsx              ← barra gov.br
│   │   ├── SiteHeader.tsx          ← header com borda amarela (client)
│   │   ├── SiteFooter.tsx          ← footer azul escuro
│   │   ├── SearchBar.tsx           ← busca da home (client)
│   │   ├── GastosChart.tsx         ← gráfico de barras horizontais (client — Recharts)
│   │   └── ParlamentarCard.tsx     ← NEW — card da grade /[casa]
│   └── lib/
│       └── mock.ts                 ← MOCK_GASTOS_HOME (ainda em uso na home)
```
