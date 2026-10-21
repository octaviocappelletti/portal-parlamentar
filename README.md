# Capivara Parlamentar

> Portal cívico de acompanhamento de senadores e deputados federais — 100% dados oficiais, sem login, sem rastreamento, custo ~R$ 0/mês.

**[portal-parlamentar.vercel.app](https://portal-parlamentar.vercel.app)**

---

## O que é

O Capivara Parlamentar concentra num único lugar a atuação de **todos os senadores e deputados federais em exercício**: gastos com a cota parlamentar (CEAP), proposições de lei e mandatos.

Os dados são públicos e garantidos por lei ([LAI 12.527/2011](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm)), mas estão fragmentados em portais do governo difíceis de navegar. O projeto os consolida, normaliza e apresenta de forma acessível.

---

## Por que é educativo

Este repositório é intencionalmente um **estudo de caso completo de civic tech no Brasil**. Você vai encontrar aqui:

- Como consumir as APIs abertas da **Câmara dos Deputados** e do **Senado Federal** — incluindo os bugs reais que encontramos e como contorná-los (documentados em `CLAUDE.md §6`)
- Como construir um **pipeline de ingestão idempotente** em Python que nunca duplica dados e tolera falhas
- Como projetar uma **arquitetura desacoplada**: a ingestão escreve; o front só lê — as APIs do governo nunca ficam no caminho crítico do usuário
- Como fazer **SSR/ISR com Next.js App Router** em dados que mudam em ritmos diferentes (proposições diariamente, despesas semanalmente, mandatos mensalmente)
- Como entregar um produto funcional **com custo zero** usando tiers gratuitos (Vercel, Neon/Supabase, GitHub Actions)

---

## Arquitetura

```
APIs oficiais → Ingestão Python → Postgres → API Express → Next.js (SSR/ISR)
 (Câmara, Senado,   (agendada via      (dados        (leitura      (somente leitura,
  Portal CEAP)       GitHub Actions,    brutos +      apenas)       SEO, sem login)
                     idempotente)       normalizados)
```

**Princípio central:** a ingestão **escreve**; o front **só lê do banco**. As APIs do governo são lentas e instáveis — nunca as chamamos em tempo real durante uma requisição do usuário.

---

## Funcionalidades

| Rota | Descrição |
|---|---|
| `/` | Home com estatísticas em tempo real e gráfico de gastos por categoria |
| `/camara` `/senado` | Grade de parlamentares com filtros por UF, partido, nome e ordenação por gasto |
| `/gastos` | Ranking global de gastos CEAP com toggle Câmara/Senado |
| `/proposicoes` | Lista global de proposições com filtros por tipo, status, ano e casa |
| `/[casa]/[id]` | Perfil do parlamentar: visão geral, gastos detalhados e proposições |
| `/[casa]/[id]/gastos` | Histórico completo de CEAP: KPIs anuais, gráfico mensal, tabela paginada |
| `/[casa]/[id]/proposicoes` | Proposições com distinção de autoria principal vs coautoria |
| `/fornecedor/[cnpj]` | Perfil do fornecedor com todos os parlamentares que o contrataram |
| `/estados` | Mapa do Brasil — navegação por estado |
| `/sobre` | Sobre o projeto |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts |
| Back-end | Node.js + Express (API própria) |
| Banco de dados | PostgreSQL (Neon Free / Supabase Free) |
| Ingestão | Python 3.11+ (`httpx`, `lxml`, `xmltodict`, `psycopg`, `tenacity`) |
| Agendamento | GitHub Actions (cron diário) |
| Deploy | Vercel Hobby |
| Custo | ~R$ 0/mês |

---

## Fontes de dados

| Fonte | O que fornece |
|---|---|
| [Câmara dos Deputados — Dados Abertos](https://dadosabertos.camara.leg.br/api/v2) | Lista de deputados, proposições, CEAP |
| [Senado Federal — Dados Abertos](https://legis.senado.leg.br/dadosabertos) | Lista de senadores, mandatos, autorias, processos |
| [Senado — CEAP](https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores) | Gastos com a Cota do Exercício da Atividade Parlamentar |
| [Receita Federal](https://dadosabertos.rfb.gov.br/) | Dados de fornecedores (CNPJ, sócios) |

Todos os dados exibidos são verificáveis diretamente nas fontes oficiais. O projeto nunca estima, interpola ou rotula dados — se um dado não é confiável, ele não vai para o front.

---

## Como rodar localmente

### Pré-requisitos

- Node.js 20+
- Python 3.11+
- PostgreSQL (ou conta gratuita no [Neon](https://neon.tech) / [Supabase](https://supabase.com))

### 1. Banco de dados

```bash
psql $DATABASE_URL < db/schema.sql
psql $DATABASE_URL < db/schema_social_orgaos.sql
psql $DATABASE_URL < db/schema_presenca.sql
```

### 2. Ingestão

```bash
cd ingestao
pip install -r requirements.txt

# Linux/macOS
python scripts/ingestao_legislativa.py
python scripts/ingestao_senadores.py
python scripts/ingestao_despesas.py
python scripts/ingestao_despesas_senadores.py

# Windows — forçar UTF-8 antes de qualquer script
$env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"
python scripts\ingestao_legislativa.py
```

### 3. API

```bash
cd api
npm install
cp .env.example .env   # preencha DATABASE_URL
npm run dev            # http://localhost:3001
```

### 4. Front-end

```bash
cd web
npm install
cp .env.example .env.local   # preencha NEXT_PUBLIC_API_URL
npm run dev                  # http://localhost:3000
```

---

## Estrutura do repositório

```
/
├── web/                    # App Next.js
│   └── src/
│       ├── app/            # Rotas (App Router)
│       ├── components/     # Componentes compartilhados
│       ├── lib/            # Cliente de API
│       └── types/          # Tipos TypeScript
├── api/                    # API Express
│   └── src/
│       ├── routes/         # Rotas por domínio
│       └── index.js
├── ingestao/               # Pipeline Python
│   ├── scripts/            # Um script por fonte de dados
│   └── lib/                # HTTP client, decode XML, upsert no banco
├── db/                     # Schema SQL
├── .github/workflows/      # Cron de ingestão (GitHub Actions)
└── CLAUDE.md               # Documentação técnica detalhada (bugs das APIs, arquitetura)
```

---

## Documentação técnica

O arquivo [`CLAUDE.md`](./CLAUDE.md) contém a documentação técnica completa do projeto, incluindo:

- Todas as rotas de API das fontes oficiais
- **Bugs conhecidos das APIs do governo e como contorná-los** — cada bug foi observado empiricamente e documentado com a resolução exata
- Convenções de código para ingestão e front-end
- Roadmap por fases

É leitura obrigatória antes de contribuir.

---

## Princípios do projeto

- **Dados oficiais, nunca inventados** — só exibimos o que pode ser verificado na fonte
- **Somente leitura, sem login, sem rastreamento** — o cidadão não precisa se cadastrar para fiscalizar
- **Desacoplamento ingestão/serviço** — o front nunca depende da disponibilidade das APIs do governo
- **Transparência** — cada dado exibe a data de atualização e a fonte oficial

---

## Contribuindo

Contribuições são bem-vindas. Antes de abrir um PR, leia o `CLAUDE.md` — especialmente a seção de bugs conhecidos das APIs para não reabrir problemas já investigados.

---

## Licença

MIT
