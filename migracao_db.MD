# Migração: Supabase → Postgres próprio + API Express

> Documento de referência para a migração do portal de transparência parlamentar.
> Registra decisões de arquitetura, ações realizadas, dificuldades técnicas e próximos passos.
> Atualizar a cada etapa concluída.

---

## 1. Contexto e motivação

O portal estava hospedado inteiramente no Supabase (free tier), que expõe o Postgres via
**PostgREST** — uma camada REST automática que o SDK do Supabase consome. A arquitetura era:

```
Next.js (Server Components) → Supabase JS SDK → PostgREST → Postgres (Supabase)
```

**Razões para migrar:**

- Custo potencial ao superar os limites do free tier (265 MB de banco, crescendo).
- Dependência de um serviço de terceiro para um dado sensível/público.
- Desejo de controle total sobre o banco e os índices.
- Servidor caseiro (Ubuntu Server 24.04) já disponível e subutilizado.

**Restrição inviolável:** o Postgres nunca será exposto diretamente à internet.
Toda comunicação externa passa pela API Express, que ficará atrás de um Cloudflare Tunnel.

---

## 2. Arquitetura alvo

```
Browser → Vercel (Next.js SSR) → HTTPS → Cloudflare Tunnel → API Express (Docker)
                                                                      ↓
                                                              Postgres (Docker)
                                                              [rede interna Docker]
```

| Camada | Tecnologia | Localização |
|---|---|---|
| Front-end | Next.js 15 (App Router, Server Components) | Vercel |
| API | Express (Node.js, CommonJS) | Docker no servidor caseiro |
| Banco | PostgreSQL 16 | Docker no servidor caseiro (container `capivara-db`) |
| Túnel | Cloudflare Tunnel | Servidor caseiro → Cloudflare → internet |

### Princípio de segurança

- O Postgres escuta apenas na rede interna Docker (`capivara-db:5432`).
- A API Express escuta em `0.0.0.0:3001` e é o único ponto de entrada externo.
- CORS restrito à origem da Vercel; autenticação via `x-api-key` no header.

---

## 3. Estado do banco migrado

**Data da migração:** julho de 2026.

**16 tabelas migradas do Supabase:**

| Tabela | Conteúdo |
|---|---|
| `parlamentar` | Perfis completos (nome, partido, UF, foto, redes sociais…) |
| `mandato` | Mandatos legislativos por parlamentar |
| `proposicao` | Proposições legislativas (PL, PEC, etc.) |
| `despesa` | Gastos da cota parlamentar — ~175 MB, tabela mais pesada |
| `fornecedor` | Dados da Receita Federal dos fornecedores |
| `fornecedor_socio` | Quadro societário dos fornecedores |
| `parlamentar_orgao` | Vínculos com órgãos e comissões |
| `override_senador` | Overrides manuais (mandatos cassados, suplentes) |
| `evento_camara` | Eventos/sessões da Câmara |
| `presenca_evento_camara` | Presença por evento (Câmara) |
| `votacao_camara` | Votações nominais da Câmara |
| `voto_camara` | Votos individuais (Câmara) |
| `votacao_senado` | Votações nominais do Senado |
| `voto_senado` | Votos individuais (Senado) |
| `tipo_comparecimento_senado` | Domínio de categorias de comparecimento |
| `presenca` | Tabela reservada para fase posterior |

**6 views** também existentes no banco (definidas nos arquivos `db/schema*.sql`):

| View | Origem | Uso no front-end |
|---|---|---|
| `despesa_totais` | `schema.sql` | Total geral de despesas na home |
| `despesa_resumo_ano` | `schema.sql` | Total por parlamentar × ano (cards e ranking) |
| `parlamentar_orgao_ativo` | `schema_social_orgaos.sql` | Órgãos sem `data_fim` no perfil |
| `voto_camara_enriquecido` | `schema_presenca.sql` | Votos + dados da votação (join) |
| `voto_senado_enriquecido` | `schema_presenca.sql` | Votos + dados da sessão (join) |
| `presenca_resumo` | `schema_presenca.sql` | % presença nos últimos 12 meses |

**Volume total:** ~265 MB. Maior tabela: `despesa` (~175 MB, ~1,2 M de linhas).

---

## 4. Decisões de arquitetura

### 4.1 API em Express puro (sem ORM, sem TypeScript)

**Decisão:** Express + `pg` (driver nativo), CommonJS (`require`/`module.exports`), sem Prisma, sem TypeORM, sem TypeScript.

**Razão:** eliminar a etapa de build no Docker. O container roda `node src/index.js` diretamente.
TypeScript adicionaria complexidade de compilação e uma camada a mais para debugar no servidor caseiro.
As queries são SQL direto — sem abstração de ORM que esconde o que vai para o banco.

### 4.2 Monorepo com dois `docker-compose`

**Decisão:** a API vive em `api/` dentro do mesmo repositório do front-end e da ingestão.
Dois arquivos `docker-compose` separados: um para o banco (`db`), um para a API.

**Razão:** simplicidade operacional. O banco e a API são serviços independentes com ciclos de
deploy diferentes. O banco raramente reinicia; a API é atualizada com frequência.

### 4.3 Pool de conexões conservador

**Decisão:** `pg.Pool` com `max: 10`, `idleTimeoutMillis: 30s`, `connectionTimeoutMillis: 5s`.

**Razão:** o Next.js em Server Components faz queries em paralelo moderado (3–7 por request).
Com 10 conexões disponíveis, há folga para picos. O servidor caseiro não é um banco de alta
concorrência — aumentar o pool além do necessário desperdiça recursos.

### 4.4 Fail-fast na inicialização

**Decisão:** `db.js` executa `SELECT 1` no startup e chama `process.exit(1)` em caso de falha.

**Razão:** com `restart: always` no Docker, o container reinicia automaticamente. Subir "silenciosamente"
com o banco inacessível mascararia o problema e levaria a erros 500 sem causa aparente nos logs.

### 4.5 Views mantidas no banco, não reescritas na API

**Decisão:** as 6 views existentes no Postgres são consultadas diretamente pela API via `SELECT * FROM view`.

**Razão:** as views já existiam no Supabase e foram migradas junto com os dados. Reescrevê-las
como queries inline na API não traria benefício e tornaria o código da API mais difícil de manter.

### 4.6 Sem paginação no endpoint de fornecedor

**Decisão:** `GET /fornecedor/:cnpj/despesas` retorna todas as despesas sem paginação.

**Razão:** o front-end da página de fornecedor processa o conjunto completo em JS para calcular
totais, grupos por parlamentar e histórico por ano. Paginar exigiria reescrever toda essa lógica
no servidor ou no cliente.
Risco: um CNPJ com muitas despesas pode retornar um payload grande. Monitorar em produção;
se necessário, adicionar paginação + aggregations no servidor em iteração futura.

### 4.7 Consolidações de endpoints (redução de round-trips)

Três situações onde a API Express faz **menos** chamadas ao banco do que o PostgREST fazia,
mesmo que o front-end continue fazendo o mesmo número de chamadas HTTP:

| Endpoint | Antes (Supabase) | Depois (API Express) |
|---|---|---|
| `GET /parlamentares/:casa/:id/presenca` | 3 chamadas PostgREST (2 counts + data) | 3 queries em `Promise.all`, 1 resposta HTTP |
| `GET /gastos` | 3 chamadas sequenciais (parlamentares → ids → despesa_resumo) | 1 query com `LEFT JOIN`, já ordenada |
| `GET /fornecedor/:cnpj/despesas` | 1 chamada PostgREST + join implícito | 1 query com `JOIN parlamentar` + `json_build_object` |

---

## 5. Ações realizadas

### Etapa 0 — Reconhecimento (concluída)

- Mapeadas todas as chamadas ao Supabase SDK no front-end (10 arquivos).
- Identificadas 6 views que o front-end consome mas que não constavam na lista de tabelas migradas
  (estavam nos arquivos `db/schema*.sql` — confirmado que existem no banco).
- Produzido inventário de 18 endpoints necessários para substituir o PostgREST.

**Arquivos inspecionados:**
`web/src/lib/db.ts`, `web/src/app/page.tsx`, `web/src/app/[casa]/page.tsx`,
`web/src/app/[casa]/[id]/layout.tsx`, `web/src/app/[casa]/[id]/page.tsx`,
`web/src/app/[casa]/[id]/gastos/page.tsx`, `web/src/app/[casa]/[id]/proposicoes/page.tsx`,
`web/src/app/[casa]/[id]/presenca/page.tsx`, `web/src/app/gastos/page.tsx`,
`web/src/app/proposicoes/page.tsx`, `web/src/app/fornecedor/[cnpj]/page.tsx`,
`web/src/types/index.ts`.

---

### Etapa 1 — Esqueleto da API Express (concluída)

Criados os seguintes arquivos em `api/`:

```
api/
├── src/
│   ├── index.js          ← Express app + morgan + handlers de 404/500 + listen(:3001)
│   ├── db.js             ← pg.Pool com DATABASE_URL, fail-fast no startup
│   └── routes/
│       └── health.js     ← GET /health → { status, db, db_time, uptime_s }
├── package.json          ← express ^4.19, pg ^8.12, morgan ^1.10, dotenv ^16.4
├── .env.example          ← DATABASE_URL, PORT, ALLOWED_ORIGIN, API_KEY
└── .gitignore            ← node_modules/, .env
```

`npm install` executado com sucesso: 115 pacotes, 0 vulnerabilidades.

---

### Etapa 2 — Endpoints de dados (concluída)

Criados 6 arquivos de rota cobrindo os 18 endpoints do inventário:

```
api/src/routes/
├── stats.js          ← GET /stats
├── parlamentares.js  ← 11 endpoints (lista, detalhe, orgaos, presença, proposições, despesas)
├── despesas.js       ← GET /despesas/resumo-ano
├── proposicoes.js    ← GET /proposicoes
├── gastos.js         ← GET /gastos
└── fornecedor.js     ← GET /fornecedor/:cnpj · /despesas · /socios
```

**Inventário completo de endpoints:**

```
GET /health
GET /stats

GET /parlamentares                              ?casa &q &uf &partido &situacao &limit &offset
GET /parlamentares/partidos                     ?casa
GET /parlamentares/presenca-resumo              ?casa &ids=1,2,3
GET /parlamentares/:casa/:idExterno
GET /parlamentares/:casa/:idExterno/orgaos
GET /parlamentares/:casa/:idExterno/presenca    ?limit &offset
GET /parlamentares/:id/proposicoes/sumario
GET /parlamentares/:id/proposicoes              ?tipo &status &ano &limit &offset
GET /parlamentares/:id/despesas/chart           ?ano
GET /parlamentares/:id/despesas/resumo          ?ano
GET /parlamentares/:id/despesas                 ?ano &mes &natureza &limit &offset

GET /despesas/resumo-ano                        ?ids=1,2,3 &ano

GET /proposicoes                                ?q &tipo &status &ano &casa &limit &offset

GET /gastos                                     ?casa &q &uf &partido &ano

GET /fornecedor/:cnpj
GET /fornecedor/:cnpj/despesas
GET /fornecedor/:cnpj/socios
```

Todos os endpoints verificados com `node --check` — sem erros de sintaxe.

---

## 6. Dificuldades técnicas e soluções

### 6.1 Conflito de rotas no Express

**Problema:** o router do Express pode confundir segmentos literais com parâmetros dinâmicos.
Por exemplo, `GET /parlamentares/partidos` poderia ser capturado por `GET /parlamentares/:casa`
(com `casa = 'partidos'`).

**Solução:** uso de regex inline nos parâmetros do Express:
- `/:casa(camara|senado)` — aceita apenas 'camara' ou 'senado', rejeita 'partidos'.
- `/:id([0-9]+)` — aceita apenas números, rejeita strings.
- Rotas literais (`/partidos`, `/presenca-resumo`) registradas **antes** das parametrizadas.

### 6.2 Views não estavam na lista de tabelas migradas

**Problema:** o inventário inicial listou 16 tabelas migradas. As 6 views
(`despesa_totais`, `despesa_resumo_ano`, `presenca_resumo`, `parlamentar_orgao_ativo`,
`voto_camara_enriquecido`, `voto_senado_enriquecido`) não constavam — indicando risco
de elas não existirem no banco novo.

**Solução:** leitura dos arquivos `db/schema.sql`, `db/schema_presenca.sql` e
`db/schema_social_orgaos.sql` confirmou que todas as views têm DDL definido e foram migradas
junto com os dados. A API as usa diretamente via `SELECT * FROM view`.

**Ação preventiva:** ao conectar o banco pela primeira vez, executar:
```sql
SELECT table_name FROM information_schema.views WHERE table_schema = 'public';
```
e confirmar que as 6 views estão listadas.

### 6.3 Construção de WHERE dinâmico com queries parametrizadas

**Problema:** o Supabase SDK constrói queries dinamicamente de forma fluente
(`.eq()`, `.ilike()`, `.in()`). Em SQL puro, é preciso construir a cláusula WHERE
e o array de parâmetros sincronizados à mão.

**Solução:** padrão adoptado em todos os endpoints:
```js
const conditions = ['coluna_fixa = $1'];
const params     = [valorFixo];
let idx = 2;

if (filtroA) { conditions.push(`coluna_a = $${idx++}`); params.push(filtroA); }
if (filtroB) { conditions.push(`coluna_b ILIKE $${idx++}`); params.push(`%${filtroB}%`); }

const where = 'WHERE ' + conditions.join(' AND ');
// params e placeholders estão sempre em sincronia
```

Condições estáticas (ex.: `p.situacao = 'Exercício'` no ranking da Câmara) são inseridas
como literais no SQL sem incrementar `idx`, pois não acrescentam parâmetro ao array.

### 6.4 Filtro de status nas proposições

**Problema:** o filtro `status=tramitacao` no Supabase usava `.or("situacao.is.null,situacao.not.ilike.%arquiv%")`,
que não tem equivalente direto em SQL parametrizado simples.

**Solução:** mapeamento dos 3 valores de status para cláusulas SQL literais (não derivadas do
input do usuário — seguras contra injeção):
```js
if (status === 'aprovadas')  conditions.push('aprovada = true');
if (status === 'arquivadas') conditions.push("situacao ILIKE '%arquiv%'");
if (status === 'tramitacao') conditions.push(
  "aprovada = false AND (situacao IS NULL OR situacao NOT ILIKE '%arquiv%')"
);
```

### 6.5 Paginação com count no mesmo response

**Problema:** o Supabase SDK retorna `{ data, count }` numa única chamada usando o header
`Prefer: count=exact`. O `pg` não tem esse mecanismo — seria necessário fazer `SELECT COUNT(*)`
separado.

**Solução:** dois queries em `Promise.all` (um `COUNT`, um `SELECT` com LIMIT/OFFSET), resolvidos
em paralelo no mesmo request. O response mantém o formato `{ data: [...], count: N }` que o
front-end já espera — minimiza mudanças na Etapa 5.

### 6.6 Parâmetro `ano` no LEFT JOIN de gastos

**Problema:** na query do ranking (`GET /gastos`), o `ano` precisa ir no `ON` do `LEFT JOIN`,
não no `WHERE` — caso contrário, o join se torna um inner join e parlamentares sem despesas
desaparecem do ranking.

**Solução:** o `ano` é adicionado ao array de `params` como último elemento, após todos os
filtros do WHERE, e seu índice (`anoIdx`) é calculado antes da query:
```js
const anoIdx = idx;   // posição do ano no array de params
params.push(ano);     // sempre o último param
// SQL: LEFT JOIN despesa_resumo_ano d ON d.parlamentar_id = p.id AND d.ano = $anoIdx
```

### 6.7 Valores monetários: NUMERIC vs float no JSON

**Problema:** o Postgres retorna colunas `NUMERIC(12,2)` como strings no `pg` (para preservar
precisão), mas o front-end espera números JavaScript.

**Solução:** cast explícito `::float8` nas queries onde o front-end usa os valores em cálculos:
```sql
SELECT valor_liquido::float8, total::float8 ...
```
Aceitável para moeda BRL com 2 casas decimais — não há perda de precisão relevante.

---

## 7. Próximos passos

### Etapa 3 — Segurança básica da API `[ concluída ]`

- [x] `cors` instalado: aceita apenas `ALLOWED_ORIGIN` (URL da Vercel); requisições sem `Origin` (server-to-server do Next.js SSR) são permitidas.
- [x] Middleware de autenticação via header `x-api-key` comparado com `API_KEY` do `.env`; `/health` isento para health checks do Docker.
- [x] Rate limiting com `express-rate-limit`: 100 req/min por IP, headers `RateLimit-*` padrão.
- [x] Requests não autorizados retornam `403 { error: "acesso negado" }`.

**Ordem dos middlewares em `api/src/index.js`:** CORS → rate limit → auth → morgan → rotas.

**Atenção:** a variável `API_SECRET_KEY` no Next.js deve ser server-side apenas
(sem prefixo `NEXT_PUBLIC_`), para que a chave nunca apareça no bundle do browser.

---

### Etapa 4 — Containerização `[ concluída ]`

Criados três arquivos:

- [x] `api/.dockerignore` — exclui `node_modules/`, `.env`, `.git`, `.md` da imagem.
- [x] `api/Dockerfile` — `node:20-alpine`, `npm ci --omit=dev`, HEALTHCHECK via `wget`, `CMD ["node", "src/index.js"]`.
- [x] `docker-compose.api.yml` (raiz do repo) — `restart: always`, `env_file: ./api/.env`, rede `capivara-net` (externa).

**Atenção antes de subir no servidor:**

1. ~~Verificar nome da rede Docker~~ — confirmado: **`capivara-db_default`**. Já corrigido no `docker-compose.api.yml`.

2. Criar o arquivo `api/.env` no servidor (copiar de `api/.env.example` e preencher).

3. Subir a API:
   ```bash
   docker compose -f docker-compose.api.yml up -d --build
   ```

4. Após Cloudflare Tunnel ativo (Etapa 7), trocar `"3001:3001"` por `"127.0.0.1:3001:3001"` no compose para não expor a porta na LAN.

---

### Etapa 5 — Refatorar o Next.js `[ concluída ]`

**Objetivo:** remover o Supabase SDK e substituir cada chamada por `fetch` à nova API.

**Checklist de mudanças:**

- [x] Removido `@supabase/supabase-js` do `web/package.json`.
- [x] Criado `web/src/lib/api.ts` com `apiFetch<T>` e `apiFetchOptional<T>` (ISR via `next: { revalidate }`).
- [x] `web/src/lib/db.ts` substituído por stub (`export const supabase = null as never`).
- [x] Removidas variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do `web/.env.local`.
- [x] Adicionadas `API_URL` e `API_SECRET_KEY` ao `web/.env.local` e `web/.env.local.example`.
- [x] Criado `web/src/app/api/despesas/route.ts` — proxy server-side para `TabelaCotas` (componente `"use client"` que não pode acessar `API_SECRET_KEY` diretamente).
- [x] `TabelaCotas.tsx` refatorado para chamar `/api/despesas` (o proxy), sem expor a chave no browser.

**Arquivos do Next.js refatorados (14):**

| Arquivo | Mudança principal |
|---|---|
| `web/src/lib/api.ts` | Novo — helper `apiFetch` + `apiFetchOptional` |
| `web/src/lib/db.ts` | Substituído por stub |
| `web/src/app/api/despesas/route.ts` | Novo — proxy para TabelaCotas |
| `web/src/components/TabelaCotas.tsx` | `supabase` → `/api/despesas` proxy |
| `web/src/app/page.tsx` | 4 queries Supabase → `GET /stats` |
| `web/src/app/[casa]/page.tsx` | 2 rounds paralelos (parlamentares+partidos, depois gastos+presença) |
| `web/src/app/[casa]/[id]/layout.tsx` | parlamentar + órgãos via `apiFetch` |
| `web/src/app/[casa]/[id]/page.tsx` | KPIs de presença + proposições + despesas |
| `web/src/app/[casa]/[id]/gastos/page.tsx` | chart + tabela paginada |
| `web/src/app/[casa]/[id]/proposicoes/page.tsx` | sumário + lista paginada |
| `web/src/app/[casa]/[id]/presenca/page.tsx` | 3 chamadas Supabase → `GET /parlamentares/:casa/:id/presenca` |
| `web/src/app/gastos/page.tsx` | 3 etapas Supabase → `GET /gastos` único |
| `web/src/app/proposicoes/page.tsx` | `GET /proposicoes` com `parlamentar` embutido |
| `web/src/app/fornecedor/[cnpj]/page.tsx` | 3 chamadas paralelas a `/fornecedor/:cnpj` |
| `web/src/app/[casa]/[id]/projetos/[proposicaoId]/page.tsx` | `GET /proposicoes/:id` |
| `web/src/app/[casa]/[id]/despesas/[despesaId]/page.tsx` | fetch paralelo + verificação de ownership |

**Endpoints adicionados à API Express nesta etapa:**

- `GET /despesas/:id` — lookup de despesa individual pelo ID interno.
- `GET /proposicoes/:id` — lookup de proposição individual pelo ID interno.

**Nota sobre variáveis de ambiente:** o `web/src/lib/api.ts` usa `process.env.API_URL` e
`process.env.API_SECRET_KEY` (sem prefixo `NEXT_PUBLIC_`). A chave **nunca** aparece no bundle do browser.

**Atenção às views do Supabase** que retornavam campos calculados:
- `despesa_resumo_ano.total` era `NUMERIC`, agora vem como `float8` (já tratado na API).
- `presenca_resumo.pct_presenca` era `NUMERIC`, agora vem como `float8`.
- O campo `parlamentar` embutido em `GET /fornecedor/:cnpj/despesas` chega como objeto JSON
  (não como string) porque a API usa `json_build_object` e o `pg` deserializa automaticamente.

---

### Etapa 6 — Teste local `[ concluída ]`

**Configuração local para teste:**

1. No servidor caseiro, subir a API apontando para `capivara-db` na rede Docker:
   ```bash
   docker compose -f docker-compose.api.yml up -d
   ```

2. No Next.js local (máquina de desenvolvimento), apontar para o IP do servidor:
   ```env
   # web/.env.local
   API_URL=http://192.168.15.20:3001
   API_SECRET_KEY=mesma-chave-do-servidor
   ```

3. Rodar o Next.js em modo de desenvolvimento:
   ```bash
   cd web && npm run dev
   ```

**Checklist de verificação:**
- [x] `GET http://192.168.15.20:3001/health` retorna `{ status: "ok", db: "connected" }`.
- [x] Home carrega com contagens reais de parlamentares e proposições.
- [x] Lista de deputados (`/camara`) exibe todos com filtros funcionando.
- [x] Perfil de um deputado carrega (KPIs de gasto, presença, proposições).
- [x] Aba Gastos exibe gráficos e tabela paginada.
- [x] Aba Proposições exibe lista paginada com filtros.
- [x] Aba Presença exibe votações nominais paginadas.
- [x] Ranking de gastos (`/gastos`) ordena corretamente.
- [x] Página de proposições globais (`/proposicoes`) filtra e pagina.
- [x] Perfil de fornecedor (`/fornecedor/[cnpj]`) exibe dados Receita + despesas + sócios.
- [x] Sem chamadas ao Supabase nos logs do browser (Network tab).
- [x] Sem variáveis `NEXT_PUBLIC_SUPABASE_*` no bundle do browser.

---

### Etapa 7 — Cloudflare Tunnel `[ pendente — fora do escopo inicial ]`

Após os testes locais confirmarem o funcionamento:

- Configurar Cloudflare Tunnel apontando para `localhost:3001` no servidor.
- Atualizar `API_BASE_URL` no painel da Vercel para o domínio do túnel (ex: `https://api.capivara.app`).
- Testar o fluxo completo com o Next.js em produção na Vercel.
- Remover o IP local `192.168.15.20:3001` de todas as variáveis de ambiente.

---

## 8. Estrutura de arquivos relevantes

```
/                                    ← raiz do monorepo
├── migracao_db.MD                   ← este documento
├── api/                             ← API Express (nova)
│   ├── src/
│   │   ├── index.js                 ← entry point
│   │   ├── db.js                    ← pg.Pool
│   │   └── routes/
│   │       ├── health.js
│   │       ├── stats.js
│   │       ├── parlamentares.js
│   │       ├── despesas.js
│   │       ├── proposicoes.js
│   │       ├── gastos.js
│   │       └── fornecedor.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── web/                             ← Next.js (refatoração pendente)
│   └── src/
│       ├── lib/db.ts                ← a ser substituído por lib/api.ts
│       └── app/                     ← pages a serem refatoradas (Etapa 5)
├── db/                              ← DDL do banco
│   ├── schema.sql
│   ├── schema_presenca.sql
│   └── schema_social_orgaos.sql
└── ingestao/                        ← scripts Python (não afetados pela migração)
```

---

## 9. Variáveis de ambiente

### API (`api/.env`)

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `DATABASE_URL` | `postgresql://appuser:senha@capivara-db:5432/capivara` | Sim |
| `PORT` | `3001` | Não (default: 3001) |
| `ALLOWED_ORIGIN` | `https://seu-app.vercel.app` | Sim (Etapa 3) |
| `API_KEY` | string longa e aleatória | Sim (Etapa 3) |

### Next.js (`web/.env.local` / painel Vercel)

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `API_URL` | `http://192.168.15.20:3001` (local) ou domínio do túnel | Sim (Etapa 5) |
| `API_SECRET_KEY` | mesma string de `API_KEY` acima | Sim (Etapa 5) |

**Remover após a Etapa 5:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
