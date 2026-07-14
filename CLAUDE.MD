# CLAUDE.md — Portal de Acompanhamento de Senadores e Deputados

> Arquivo de contexto para desenvolvimento assistido na CLI. Leia isto antes de gerar
> qualquer código. Contém a arquitetura, as rotas de API oficiais, e — o mais importante —
> os **bugs conhecidos das APIs do governo e como contorná-los**. Vários desses bugs já
> custaram horas de retrabalho; estão documentados aqui para não se repetir.

---

## 1. Objetivo do projeto

Portal cívico **somente-leitura, sem login e sem rastreamento** que concentra num único lugar
a atuação de **todos os senadores e deputados federais em exercício**. Os dados são abertos e
garantidos por lei (LAI 12.527/2011), mas hoje estão fragmentados em vários portais oficiais.

O usuário navega: **Home → [Senado | Câmara] → lista (foto, nome, partido, UF) → detalhe do
parlamentar → drill-down em projetos (íntegra) e despesas (nota fiscal)**.

### Princípio inviolável: dados oficiais, nunca inventar

> **Só exibimos o que pode ser verificado de forma confiável na fonte oficial.**
> Nunca estimar, completar, interpolar ou rotular. Se um dado depende de heurística frágil,
> ele é coletado e auditado no banco, mas **não vai para o front** até ser confiável.
> (Ex.: emendas a MPV foram coletadas mas removidas da UI por dependerem de regex — ver §6.)

---

## 2. Arquitetura

```
Fontes oficiais → Ingestão Python (agendada) → Postgres → API leitura → Next.js (SSR/ISR)
   (Câmara,          (idempotente, com cache)     (raw +      (PostgREST    (somente leitura,
    Senado,                                        normalizado) ou routes)    SEO, sem login)
    CEAP)
```

**Regra de ouro do desacoplamento:** a ingestão **escreve**; o front **só lê do Postgres**,
nunca das APIs do governo em tempo real. As APIs oficiais são lentas e instáveis — mantê-las
fora do caminho crítico da requisição do usuário é o que garante o site no ar e habilita o
histórico temporal (o diferencial do projeto).

---

## 3. Stack e ferramentas (tiers gratuitos)

| Camada | Ferramenta | Notas |
|---|---|---|
| Front + serviço | **Next.js (App Router) na Vercel Hobby** | SSR/ISR, TypeScript, React, Tailwind, recharts |
| Banco | **Postgres (Supabase Free ou Neon Free)** | Supabase dá REST automático (PostgREST) |
| Ingestão | **Python 3.11+** (`httpx`, `lxml`/`xmltodict`, `psycopg[binary]`, `tenacity`) | scripts por fonte |
| Agendador | **GitHub Actions (cron)** | dispara a ingestão sem servidor ligado |
| Repo/CI | **GitHub** | — |

Custo alvo: **~R$ 0/mês**. Primeiro gargalo esperado: tamanho do banco por causa das
despesas CEAP. Mitigar guardando anos de mandato vigente e não duplicando o `raw`.

---

## 4. Estrutura de repositório sugerida

```
/
├── CLAUDE.md                      ← este arquivo
├── web/                           ← app Next.js
│   ├── src/app/
│   │   ├── page.tsx               ← Home ([Senado] [Câmara])
│   │   ├── [casa]/page.tsx        ← lista (foto, nome, partido, UF)
│   │   ├── [casa]/[id]/page.tsx   ← detalhe do parlamentar
│   │   ├── [casa]/[id]/projetos/[proposicaoId]/page.tsx  ← íntegra da proposição
│   │   └── [casa]/[id]/despesas/[despesaId]/page.tsx     ← detalhe da despesa
│   ├── src/components/            ← PainelAtuacao, TabelaCotas, ListaProposicoes, etc.
│   ├── src/lib/db.ts              ← acesso ao Postgres / cliente Supabase
│   └── src/types/index.ts        ← tipos TS compartilhados
├── ingestao/                      ← pipeline Python
│   ├── scripts/
│   │   ├── ingestao_legislativa.py        ← lista + proposições Câmara
│   │   ├── ingestao_senadores.py          ← mandatos + autorias + processos Senado
│   │   ├── ingestao_despesas.py           ← CEAP Câmara (paginado por deputado)
│   │   └── ingestao_despesas_senadores.py ← CEAP Senado (tudo por ano)
│   ├── lib/
│   │   ├── http.py                ← client httpx com retry/backoff/cache
│   │   ├── senado_decode.py       ← decode XML/JSON + fix Windows-1252 (§6.15)
│   │   └── db.py                  ← upsert idempotente no Postgres
│   └── .cache/                    ← respostas cruas (NÃO versionar)
├── db/
│   └── schema.sql                 ← DDL das tabelas
└── .github/workflows/ingest.yml   ← cron da ingestão
```

---

## 5. Rotas de API oficiais

### 5.1 Câmara dos Deputados — `https://dadosabertos.camara.leg.br/api/v2` (JSON)

| Método / Rota | Uso | Observação crítica |
|---|---|---|
| `GET /deputados?idLegislatura={LEG}&pagina={N}&itens=100` | Lista de deputados | **Não filtre por UF** (uma chamada por UF causa 504). Baixe tudo paginado e filtre em memória. Ver §6.5 |
| `GET /deputados/{id}` | Detalhe do deputado | **Único** endpoint que expõe **CPF** e nome civil. Exige 1 chamada por deputado (§6.3) |
| `GET /deputados/{id}/despesas?ano={ano}&itens=100&pagina={N}` | CEAP do deputado | tipo, mês, fornecedor, CNPJ, valor líquido, glosa, URL do documento |
| `GET /proposicoes?idDeputadoAutor={id}&siglaTipo={PL\|PLP\|PEC\|PDL}` | Proposições de autoria | **Não distingue autor de coautor** e **não traz status**. Ver §6.1 e §6.6 |
| `GET /proposicoes/{id}` | Detalhe da proposição | Traz `statusProposicao.codSituacao` — **use isto** para classificar situação (§6.1) |
| `GET /proposicoes/{id}/autores` | Autores da proposição | Traz `ordemAssinatura` / `proponente` — **use para identificar autor principal** (§6.6) |

> **Legislatura vigente:** em jul/2026 é a **57ª** (2023–2027). Torne `LEG` configurável por env
> (`LEGISLATURA_CAMARA=57`). Os docs anteriores usaram a 56ª — não hardcode a 56.

### 5.2 Senado — `https://legis.senado.leg.br/dadosabertos` (XML e JSON misturados)

| Método / Rota | Formato | Uso | Observação crítica |
|---|---|---|---|
| `GET /senador/lista/legislatura/{leg}` | XML | Lista de senadores | Senadores servem 8 anos → cobrem 2 legislaturas. Para pegar **todos os atuais**, consulte a legislatura vigente; para histórico/reeleição, faça merge de duas (§6.16) |
| `GET /senador/{codigo}` | XML | Detalhe | Traz `DataNascimento`. **Não expõe CPF** → match por nascimento+UF (§6.8) |
| `GET /senador/{codigo}/mandatos` | XML | Mandatos | Pegue a data de início do mandato — usar como `dataInicio` nos filtros seguintes (§6.12) |
| `GET /senador/{codigo}/autorias` | XML | PEC/PL de autoria | **Já traz `IndicadorAutorPrincipal` (Sim/Não)** — sem chamadas extras (§6.6). Filtre siglas `PEC`, `PL`, `PLS` client-side |
| `GET /processo?codigoParlamentarAutor={cod}&sigla={PEC\|PL}&dataInicio={data}` | JSON | Proposições no período | Aprovação = campo `normaGerada` preenchido. **`siglaSituacao` e `situacaoAtual` NÃO são confiáveis** (§6.9). Retorna **duplicatas** → dedup por `(numero, ano)` (§6.11) |
| `GET /processo/emenda?codigoParlamentarAutor={cod}&dataInicio={data}` | JSON | Emendas | **Sempre** passe `dataInicio` = início do mandato, senão 503/timeout (§6.12). Filtro MPV é regex frágil → coletar mas não exibir (§6, princípio) |

> **NÃO use** `GET /processo?autoria={nome}&tipoDocumento={tipo}`. O parâmetro `autoria` é
> silenciosamente ignorado e retorna **todas** as proposições do tipo (dados lixo). Ver §6.7.

### 5.3 Senado — despesas CEAP — `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores` (JSON)

| Método / Rota | Uso | Observação |
|---|---|---|
| `GET /despesas_ceaps/{ano}` | CEAP de **todos** os senadores no ano | Retorna tudo de uma vez (≠ Câmara, que pagina por deputado). Filtre por `codSenador` client-side. Campos: `codSenador`, `nomeSenador`, `mes`, `tipoDespesa`, `fornecedor`, `cpfCnpj`, `valorReembolsado`, `data`, `documento`, `detalhamento` |

---

## 6. Bugs conhecidos das APIs e como resolver

> Esta é a seção mais importante do arquivo. Cada item já foi observado empiricamente.
> **Não "teste de novo para ver se funciona" — já não funciona.** Aplique a resolução.

### 6.1 Câmara: `codSituacao` é ignorado com `idDeputadoAutor`
Filtrar `/proposicoes?codSituacao={cod}&idDeputadoAutor={id}` retorna **todas** as proposições
independentemente da situação (confirmado: 351 proposições devolvidas para qualquer `codSituacao`).
**Resolução:** buscar a lista sem filtro de situação e chamar `GET /proposicoes/{id}` individualmente
para ler `statusProposicao.codSituacao`. Classifique:
- aprovada → `{1140}` (Transformado em Norma Jurídica)
- arquivada → `{923, 930, 931, 941, 950, 1285, 1292}`
- em tramitação → resto (inclusive `None`)

### 6.2 Câmara: a lista de proposições não traz status
`/proposicoes?idDeputadoAutor={id}` retorna ~8 campos, **sem** `statusProposicao`.
**Resolução:** uma chamada de detalhe por proposição (`/proposicoes/{id}`). Paralelize com
`ThreadPoolExecutor(max_workers=5)` + ~0.1s/thread e **cache em disco/banco**. Primeira execução
é cara (dezenas de milhares de chamadas), as seguintes vêm do cache.

### 6.3 Câmara: CPF não está na listagem
`/deputados` não inclui CPF. Só `/deputados/{id}` traz.
**Resolução:** percorrer os ~513 deputados com 1 chamada cada, montar índice `{cpf: deputado}`,
cachear. Necessário se for cruzar com TSE.

### 6.4 Câmara: votações/votos por deputado não existem na v2
`/deputados/{id}/votacoes` e `/deputados/{id}/votos` retornam **405**.
**Resolução:** não há como puxar o voto nominal por deputado de forma direta. A alternativa
(iterar todas as votações plenárias) é inviável. **Presença/votos ficam para fase posterior**
e exigem outra fonte — ver §6.17.

### 6.5 Câmara: 504 Gateway Timeout ao paginar por UF
27 chamadas `/deputados?siglaUf={UF}` estouram timeout sob instabilidade do servidor.
**Resolução:** **uma** sequência paginada sem filtro de UF (`?idLegislatura={LEG}`), ~6 páginas,
filtro de UF em memória. Adicione retry com backoff exponencial (1s → 4s → 16s) para 5xx.

### 6.6 Autoria principal vs coautoria (requisito central do projeto)
Muitos parlamentares só assinam como coautores. **Precisamos separar autor principal.**
- **Senado:** fácil — `/senador/{codigo}/autorias` já traz `IndicadorAutorPrincipal`.
- **Câmara:** a lista `/proposicoes?idDeputadoAutor` **não distingue**. Use
  `GET /proposicoes/{id}/autores` e trate como autor principal quem tem `ordemAssinatura == 1`
  (ou `proponente == true`). Custa 1 chamada extra por proposição → cachear.

### 6.7 Senado: `?autoria={nome}` é ignorado (dados lixo)
Retornava `total_apresentadas = 42.664` idêntico para todos e proposições de 1949.
**Resolução:** nunca usar. Use `/senador/{codigo}/autorias` (identificado por código).

### 6.8 Senado: sem CPF em nenhum endpoint público
`/senador/{codigo}/cpf` → 404; o XML de `/senador/{codigo}` não traz CPF.
**Resolução:** chave surrogate **`(UF, data_nascimento_iso)`** extraída do XML. Universo pequeno
(~160), colisão improvável; ainda assim registre a confiança do match.

### 6.9 Senado: `siglaSituacao`/`situacaoAtual` não confiáveis
`/processo?codigoParlamentarAutor=...&siglaSituacao=TNJR` retorna **vazio**. `situacaoAtual`
também mente (ex.: `PL 4815/2019` tinha `situacaoAtual="REMETIDA À CÂMARA"` mas já era lei).
**Resolução:** determinar aprovação **apenas** por `normaGerada` preenchido.

### 6.10 Senado: PLS vs PL (mudança de 2019)
Antes de 2019 projetos do Senado eram **PLS**; depois viraram **PL**.
**Resolução:** filtrar `{"PLS", "PL"}` e normalizar `PLS → PL` no dado de saída.

### 6.11 Senado: `/processo` retorna duplicatas
A mesma PEC/PL aparece 2+ vezes, inflando contadores.
**Resolução:** dedup client-side por `(numero, ano)`.

### 6.12 Senado: `/processo/emenda` com `dataInicio=1990` dá 503/timeout
Puxa a carreira inteira (inclui período de deputado) → payloads de 1–2 MB.
**Resolução:** buscar início do mandato em `/senador/{codigo}/mandatos` e usar como `dataInicio`.
Respostas caem para ~200 registros e ~2–3s.

### 6.13 Senado: emendas MPV misturadas com outros tipos
`/processo/emenda` não filtra por tipo.
**Resolução:** regex `\bMPV\b` no campo `identificacao`. **Frágil** — coletar e auditar, mas
não exibir na UI (princípio §1).

### 6.14 Determinação de "autor único" em emendas é heurística
Sem `IndicadorAutorPrincipal` nas emendas; só o campo texto `autoria`.
**Resolução:** proxy = ausência de `;`. Impreciso (comissões/lideranças). Não exibir.

### 6.15 Encoding — dois problemas distintos
1. **Resposta da API (Senado `/processo`):** o campo `normaGerada` traz `º` (U+00BA) em
   **Windows-1252** mas o header declara UTF-8 → vira `�`. **Resolução:** decodifique
   `resp.content` tentando `utf-8` estrito e, no `UnicodeDecodeError`, caia para `windows-1252`.
   Invalide caches corrompidos (`senado_processo_*.json`) antes de reprocessar.
2. **Terminal Windows (cp1252):** `print("→")` lança `UnicodeEncodeError` e aborta o script.
   **Resolução:** use `->` nos logs **e** force UTF-8:
   ```powershell
   $env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"
   ```

### 6.16 Senado: legislaturas cruzadas
Um senador cobre duas legislaturas (mandato de 8 anos). `/senador/lista/legislatura/{leg}` de uma
única legislatura pode não listar todos os relevantes.
**Resolução:** para o portal (parlamentares **atuais**), use a legislatura vigente. Para histórico
de mandatos/reeleição, faça merge deduplicado de duas legislaturas pelo código do senador.

### 6.17 Presença em plenário — sem fonte pronta na API
Nenhuma das duas APIs expõe "presença" como campo direto; Câmara nem votação nominal por deputado
tem (§6.4). É **métrica derivada** de sessões/eventos.
**Resolução:** tratar como **fase posterior**; definir a fonte exata (ex.: dataset de presença/sessões
publicado à parte) antes de modelar. Não prometer o dado na UI enquanto não houver fonte confiável.

---

## 7. Convenções de código

**Ingestão (Python)**
- **Idempotência:** gravar resposta crua em tabela/coluna `raw` (com `fetched_at` + hash) e depois
  `upsert` (`INSERT ... ON CONFLICT DO UPDATE`). Reexecutar nunca duplica.
- **Cache em disco** durante desenvolvimento (`ingestao/.cache/`, não versionado); em produção o
  próprio `raw` no Postgres serve de cache.
- **HTTP:** `httpx` com timeout curto, retry/backoff (`tenacity`) para 5xx, concorrência limitada.
  As APIs punem paralelismo agressivo — prefira sequencial com pausa curta.
- **Incremental:** reprocessar sempre o **ano corrente inteiro** (dados retroativos mudam); anos
  fechados só uma vez.
- **XML do Senado:** converter para dict logo na borda (`lxml`/`xmltodict`) e trabalhar em JSON internamente.
- Isolar todo parsing do Senado (XML/JSON + fix de encoding) numa camada única (`lib/senado_decode.py`).

**Front (Next.js)**
- **Só lê do Postgres.** Nada de chamar API do governo no request do usuário.
- SSR/ISR com `revalidate` (proposições ~diário, despesas ~semanal, mandatos ~mensal).
- Exibir sempre "Atualizado em DD/MM/AAAA" e a fonte oficial (transparência).
- Nunca renderizar seção vazia — exibir mensagem explicativa quando não houver dado.

---

## 8. Modelo de dados (referência)

`parlamentar` (id, casa, id_externo, nome, nome_civil, partido, uf, foto_url, cpf?, data_nascimento) ·
`mandato` (parlamentar_id, legislatura, data_inicio, data_fim) ·
`proposicao` (parlamentar_id, tipo, numero, ano, ementa, autor_principal, situacao, aprovada, data_apresentacao, url_inteiro_teor) ·
`despesa` (parlamentar_id, ano, mes, natureza, fornecedor, cpf_cnpj, valor_liquido, valor_glosa, url_documento, detalhamento) ·
`presenca` (parlamentar_id, ano, mes, sessoes_previstas, presencas, ausencias) — fase posterior (§6.17).

Chaves de dedup/upsert: proposição por `(casa, tipo, numero, ano)`; despesa por
`(parlamentar_id, ano, mes, fornecedor, valor_liquido, documento)`.

---

## 9. Comandos

```bash
# Front
cd web && npm install && npm run dev

# Ingestão (Linux/macOS)
cd ingestao && pip install -r requirements.txt
python scripts/ingestao_legislativa.py
python scripts/ingestao_despesas.py
python scripts/ingestao_senadores.py
python scripts/ingestao_despesas_senadores.py
```

```powershell
# Ingestão (Windows) — SEMPRE forçar UTF-8 antes (§6.15)
$env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"
cd ingestao
python scripts\ingestao_legislativa.py
```

O cache bruto fica em `ingestao/.cache/` (não versionado). Apagar força re-download.

---

## 10. Roadmap por fases

1. **Fundação:** listas Câmara+Senado → Postgres → Home, listas, detalhe básico (nome, partido, UF, foto, mandatos).
2. **Projetos:** proposições com situação (§6.1) e **autoria principal** (§6.6); tela de projetos + série temporal + íntegra.
3. **Cotas:** CEAP das duas casas, tabela mês × natureza, drill-down da despesa (fornecedor/nota).
4. **Presença e rastreabilidade:** definir fonte de presença (§6.17); consolidar histórico entre mandatos.

Cada fase é entregável e testável isoladamente. O desacoplamento ingestão/serviço permite evoluir
o pipeline sem quebrar o site.

---

## 11. O que as APIs NÃO permitem (evita retrabalho)

| Desejado | Rota | Resultado | Fazer em vez disso |
|---|---|---|---|
| Filtrar situação (Câmara) | `/proposicoes?codSituacao=&idDeputadoAutor=` | ignorado | detalhe por `/proposicoes/{id}` (§6.1) |
| Voto/presença por deputado | `/deputados/{id}/votacoes` `.../votos` | 405 | fase posterior, outra fonte (§6.4, §6.17) |
| Filtrar por autor (Senado) | `/processo?autoria={nome}` | ignorado | `/senador/{codigo}/autorias` (§6.7) |
| Aprovadas direto (Senado) | `/processo?...&siglaSituacao=TNJR` | vazio | filtrar por `normaGerada` (§6.9) |
| CPF (Senado) | `/senador/{codigo}` | ausente | match por nascimento+UF (§6.8) |
| Emendas por tipo (Senado) | `/processo/emenda?sigla=MPV` | inexistente | regex client-side, não exibir (§6.13) |
```