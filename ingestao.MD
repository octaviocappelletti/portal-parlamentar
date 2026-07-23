# Diário de Ingestão — Portal Parlamentar

Registro cronológico de execuções, erros encontrados e soluções adotadas.
Complementa o `CLAUDE.MD` (que documenta bugs *conhecidos* das APIs); este arquivo
documenta o que foi *descoberto em campo* durante as primeiras execuções reais.

---

## 2026-07-14 — Primeira ingestão completa

### Ambiente

| Item | Versão |
|---|---|
| Python | 3.14.0 |
| psycopg | 3.3.4 (binary) |
| httpx | 0.28.1 |
| lxml | 6.1.0 |
| Sistema | Windows 10 Pro (PowerShell) |

---

### Problema 1 — `psycopg[binary]==3.1.20` incompatível com Python 3.14

**Sintoma:**
```
ERROR: Could not find a version that satisfies the requirement
psycopg-binary==3.1.20 (from versions: 3.2.10, 3.2.11, ..., 3.3.4)
```

**Causa:** O wheel binário do `psycopg` 3.1.x não foi compilado para Python 3.14.
A versão mínima com suporte é a 3.2.10.

**Solução:** Trocar pin exato por versão mínima no `requirements.txt`:
```
# antes
psycopg[binary]==3.1.20

# depois
psycopg[binary]>=3.2.10
```
Pip instalou automaticamente a 3.3.4 (mais recente estável).

---

### Problema 2 — `DATABASE_URL` com valores placeholder

**Sintoma:**
```
psycopg.OperationalError: failed to resolve host 'host': [Errno 11001] getaddrinfo failed
```

**Causa:** O arquivo `ingestao/.env` foi criado a partir do `.env.example` mas não foi
editado com as credenciais reais do Supabase. O host literal `host` não existe como
endereço DNS.

**Solução:** Preencher `ingestao/.env` com a connection string real do Supabase:
```
DATABASE_URL=postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres
```
Encontrada em: **Supabase → Project Settings → Database → Connection string → URI (Session mode, porta 5432)**.

> **Atenção:** usar sempre Session mode (porta 5432), nunca Transaction mode (porta 6543),
> pois a ingestão mantém conexões abertas durante o commit em lote.

---

### Problema 3 — Endpoint `/senador/{cod}/autorias` desativado

**Sintoma:** Ingestão de senadores completou sem erros mas a tabela `proposicao`
ficou com zero registros para a casa `senado`.

**Investigação:** Teste manual do endpoint retornou XML com metadado de descontinuação:
```xml
<Descontinuacao>
  <DataDepreciacao>2025-03-18</DataDepreciacao>
  <DataDesativacaoCompleta>2026-02-01</DataDesativacaoCompleta>
  <UrlServicoSubstituto>https://legis.senado.leg.br/dadosabertos/processo</UrlServicoSubstituto>
</Descontinuacao>
```
O endpoint foi **desativado em 2026-02-01**. Retorna estrutura XML mas sem dados
de autoria — apenas os metadados de descontinuação.

**Problema secundário:** O `CLAUDE.MD` documentava o root XML como `AutoriasParlamentar`,
mas o endpoint histórico usava `MateriasAutoriaParlamentar`. O path estava errado
*e* o endpoint estava morto.

**Solução:** Substituir `fetch_autorias()` inteiramente pelo endpoint `/processo`,
que é o substituto oficial indicado pela própria API.

Campos relevantes no `/processo` (formato JSON):
| Campo | Uso |
|---|---|
| `identificacao` | `"PL 372/2021"` — parse com regex para extrair tipo/numero/ano |
| `objetivo` | `"Iniciadora"` = autor principal; outros valores = coautor |
| `normaGerada` | Preenchido = aprovada (§6.9 do CLAUDE.MD) |
| `urlDocumento` | Link para o texto integral |
| `dataApresentacao` | Data de apresentação |

Regex de parse do campo `identificacao`:
```python
RE_IDENT = re.compile(r"^(\w+)\s+(\d+)/(\d{4})")
```

**Resultado:** Após a correção, Renan Calheiros (cod 70) retornou 104 proposições
corretamente categorizadas.

> Atualizar o `CLAUDE.MD` (§6.6) para registrar que `/autorias` está desativado
> e que o substituto é `/processo` com `objetivo == "Iniciadora"` para autoria principal.

---

### Problema 4 — API retorna 245 senadores em vez dos 81 esperados

**Sintoma:** Após ingestão, banco continha 245 registros com `casa = 'senado'`,
mais do que o triplo dos 81 senadores reais.

**Investigação:** Análise do XML da listagem `/senador/lista/legislatura/57` revelou
que a API retorna **3 pessoas por vaga** — o Titular e seus dois suplentes:

```
'Titular':      82  — ex: Alan Rick (representa a si mesmo)
'1º Suplente':  82  — ex: Alberto David (titular: Randolfe Rodrigues)
'2º Suplente':  81  — ex: Adilson Gomes (titular: Jarbas Vasconcelos)
Total:         245
```

O campo discriminante (`DescricaoParticipacao`) está em `Mandatos.Mandato`,
**não** em `IdentificacaoParlamentar` — por isso não foi detectado no parse inicial.

Os 82 titulares (e não 81) refletem uma vaga com situação especial durante a
legislatura (cassação, morte ou mandato tampão).

**Solução:** Filtrar apenas `DescricaoParticipacao == "Titular"` antes de processar:
```python
def _participacao(p: dict) -> str:
    mandatos = ensure_list(p.get("Mandatos", {}).get("Mandato", {}))
    mandato = next((m for m in mandatos if str(m.get(
        "SegundaLegislaturaDoMandato", {}).get("NumeroLegislatura", "")) == str(LEG)
        or str(m.get("PrimeiraLegislaturaDoMandato", {})
        .get("NumeroLegislatura", "")) == str(LEG)), mandatos[0] if mandatos else {})
    return mandato.get("DescricaoParticipacao", "")

titulares = [p for p in todos if _participacao(p) == "Titular"]
```

**Ação corretiva no banco:** Excluir todos os senadores (e seus dados dependentes)
e re-rodar a ingestão com o filtro aplicado.

---

### Problema 5 — 10 senadores sem `UF` após re-ingestão

**Sintoma:** Consulta pós-ingestão revelou 10 registros com `uf IS NULL`:

```
Arolde de Oliveira, Flávio Dino, Jarbas Vasconcelos, Jorge Seif,
Jorginho Mello, Juíza Selma, Major Olimpio, Mecias de Jesus,
Rodrigo Cunha, Wellington Dias
```

**Investigação:** Comparação do XML de detalhe entre um senador com UF (Renan Calheiros)
e um sem UF (Flávio Dino) mostrou que o campo `UfParlamentar` some de
`IdentificacaoParlamentar` quando o parlamentar **deixa o cargo** durante a legislatura
(nomeação a ministério, STF, falecimento, renúncia).

O campo ainda existe, mas está em `Mandatos.Mandato.UfParlamentar` na resposta
da listagem — que é onde o parse inicial deveria ter buscado como fallback.

Perfil dos afetados: todos têm em comum algum evento que encerrou o mandato
(ex.: Flávio Dino → nomeado ao STF em 2023; Major Olimpio → faleceu em 2021;
Wellington Dias → nomeado ministro).

**Solução:** Adicionar fallback em `parse_senador()`:
```python
uf = dados.get("UfParlamentar")
if not uf:
    mandato_raw = p.get("Mandatos", {}).get("Mandato", {})
    mandatos = ensure_list(mandato_raw)
    uf = next((m.get("UfParlamentar") for m in mandatos if m.get("UfParlamentar")), None)
```

**Resultado esperado após re-execução:** 0 senadores com UF nula.

---

### Resultado final da sessão

| Tabela | Registros |
|---|---|
| `parlamentar` (câmara) | ~876 (ingestão ainda em curso ao encerrar a sessão) |
| `parlamentar` (senado) | 82 titulares |
| `proposicao` (câmara) | ~42.000 |
| `proposicao` (senado) | ~6.175 |
| `despesa` (câmara) | ~82.000 registros / R$ 101 Mi |
| `despesa` (senado) | 9.403 registros / R$ 15,3 Mi |

---

### Pendências para próxima sessão

- [ ] Verificar contagem final de deputados após conclusão da `ingestao_legislativa.py`
- [ ] Confirmar que os 10 senadores sem UF foram corrigidos após re-execução
- [ ] Rodar `ingestao_despesas.py` para anos anteriores (atualmente só ano corrente)
- [ ] Avaliar performance da ingestão de proposições da Câmara (ThreadPoolExecutor 5 workers)
- [ ] Decidir estratégia para anos fechados: re-processar vs. marcar como completo e pular

---

## 2026-07-16 — Correções de dados e melhorias no front-end

---

### Problema 6 — Front-end exibia mais de 513 deputados

**Sintoma:** A página `/camara` listava deputados além dos 513 em exercício,
incluindo parlamentares afastados, em licença, com mandato suspenso etc.

**Causa:** A ingestão armazenava todos os deputados retornados pelo endpoint de
listagem da Câmara (`GET /deputados?idLegislatura=57`) sem verificar o status
individual. O campo `ultimoStatus.situacao` de `GET /deputados/{id}` contém o
status real (`"Exercício"`, `"Licença"`, `"Vacância"`, etc.), mas não era usado.

**Solução:**

1. Adicionada coluna `situacao TEXT` à tabela `parlamentar`:
```sql
ALTER TABLE parlamentar ADD COLUMN IF NOT EXISTS situacao TEXT;
CREATE INDEX IF NOT EXISTS idx_parlamentar_situacao ON parlamentar(casa, situacao);
```

2. `enrich_deputado()` em `ingestao_legislativa.py` passa a extrair
   `d.get("ultimoStatus", {}).get("situacao")` e armazená-lo no banco.

3. O loop `main()` da Câmara pula deputados com `situacao != "Exercício"` com log:
```
IGNORADO 12345 Nome — situacao: 'Licença'
```

4. O script do Senado passa `situacao = "Exercício"` fixo (já filtrado por
   Titulares + `SUPLENTES_EM_EXERCICIO`).

5. Front: `[casa]/page.tsx` aplica `.eq("situacao", "Exercício")` para Câmara;
   `page.tsx` aplica o mesmo filtro no contador da home.

**Migração necessária após deploy:**
```sql
DELETE FROM parlamentar WHERE casa = 'camara' AND situacao IS DISTINCT FROM 'Exercício';
```

---

### Problema 7 — Situação das proposições do Senado sempre `NULL` ou incorreta

**Sintoma:** Todas as proposições do Senado tinham `situacao = NULL` ou
`situacao = 'aprovada'` baseado exclusivamente em `normaGerada`, ignorando
proposições arquivadas e em tramitação.

**Causa:** O campo `siglaSituacao`/`situacaoAtual` é não-confiável quando usado
como filtro de chamada (§6.9), mas o *conteúdo* de `situacaoAtual` na resposta,
combinado com o campo `tramitando`, é suficientemente confiável para classificação.

**Solução:** Função `classifica_situacao_senado(proc)` com três regras em ordem:

| Regra | Condição | Categoria |
|---|---|---|
| 1 | `tramitando == "Sim"` | `"em tramitacao"` (prioritária, ignora situacaoAtual) |
| 2a | `normaGerada` preenchido **OU** `"APROVADO"` em `siglaTipoDeliberacao` **OU** keyword de aprovação em `situacaoAtual` | `"aprovada"` |
| 2b | Keyword de arquivamento em `situacaoAtual` | `"arquivada"` |
| 2c | Fallback (tramitando="Não", sem match) | `"arquivada"` + log de aviso |

Keywords de aprovação: `APROVAD`, `TRANSFORMADA EM NORMA JURÍDICA`, `REMETIDA À SANÇÃO`,
`REMETIDA À PROMULGAÇÃO`, `EM VIGOR`, `VETO DERRUBADO`, `REQUERIMENTO APROVADO`.

Keywords de arquivamento: `ARQUIVAD`, `REJEITAD`, `PREJUDICAD`, `RETIRADA`, `RETIRADO`,
`REVOGADA`, `SEM EFICÁCIA`, `VETO MANTIDO`, `DESISTÊNCIA`, `ANEXADA`, `IMPUGNADA`,
`INDEFERID`, `EXTINTA`, `DESCONSTITUÍDO`, `NÃO ADMISSÃO`, `NÃO ATENDIMENTO`.

`fetch_processos()` passou a fazer **duas chamadas por sigla** (`tramitando=S` e
`tramitando=N`) em vez de uma, para preservar o campo `tramitando` no objeto
retornado e alimentar a classificação.

---

### Problema 8 — Proposições com co-autoria vinculadas ao autor errado

**Sintoma:** A PEC 15/2026 (1º autor: Dep. Saulo Pedroso, cod=226837) aparecia no
card do Dep. Acácio Favacho (cod=204379), que é apenas coautor. O card de Saulo
não mostrava a PEC.

**Causa:** A constraint `UNIQUE (casa, tipo, numero, ano)` na tabela `proposicao`
permitia apenas **uma linha por proposição**. O `ON CONFLICT DO UPDATE` atualizava
`autor_principal` mas **não atualizava `parlamentar_id`** — que ficava com quem
foi processado primeiro (ordem alfabética ≈ Acácio antes de Saulo).

**Solução:** Alterar a constraint para incluir `parlamentar_id`, criando uma linha
por dupla (proposição × parlamentar):

```sql
ALTER TABLE proposicao
  DROP CONSTRAINT IF EXISTS proposicao_casa_tipo_numero_ano_key;
ALTER TABLE proposicao
  ADD CONSTRAINT proposicao_casa_tipo_numero_ano_parlamentar_id_key
  UNIQUE (casa, tipo, numero, ano, parlamentar_id);
```

`upsert_proposicao()` em `lib/db.py` atualizado com a nova chave de conflito.

**Ação corretiva:** `DELETE FROM proposicao;` seguido de re-ingestão completa
para ambas as casas.

---

### Problema 9 — Proposições de outros senadores aparecendo no card errado

**Sintoma:** A PEC 10/2026 (de Damares Alves, cod=6335) aparecia no card da
Senadora Daniella Ribeiro (cod=5998), que não é autora da PEC.

**Investigação com `check_objetivo_senado.py`:**

O endpoint `/processo?codigoParlamentarAutor=X` retorna proposições onde o senador
está envolvido em **qualquer capacidade** (autor, relator, signatário de parecer etc.),
não apenas como autor. O campo `objetivo` descreve o papel do parlamentar.

Resultado do diagnóstico:
```
Daniella Ribeiro (5998):
  'Iniciadora' → 118 proposições  ex: PEC 4/2019
  — PEC 10/2026 ENCONTRADO com objetivo='Iniciadora'

Damares Alves (6335):
  'Iniciadora' → 188 proposições  ex: PEC 1/2023
  — PEC 10/2026 ENCONTRADO com objetivo='Iniciadora'
```

**Conclusão:** Ambas as senadoras são **co-autoras** (co-iniciadoras) da PEC 10/2026.
O Senado trata todos os apresentadores conjuntos como `objetivo='Iniciadora'` — sem
hierarquia entre eles. Diferente da Câmara, onde `ordemAssinatura` determina o 1º autor.

**Implicação para o modelo de dados:**
- Para o Senado, `autor_principal = True` para TODOS os co-iniciadores de uma proposição.
- Não há como determinar quem é "o" primeiro autor entre múltiplos `"Iniciadora"`.
- Os cards "Como 1º autor" e "Aprovadas (1º autor)" foram **removidos** da página
  de senadores no front-end, pois o conceito não existe na API atual.
- O botão "Somente 1º autor" na lista de proposições também foi removido para senadores.

**Solução de filtragem:** Adicionado filtro em `fetch_processos()` para descartar
itens cujo `objetivo` não indica autoria, caso a API evolua e passe a retornar
valores não-autoria para o parâmetro `codigoParlamentarAutor`:

```python
OBJETIVO_AUTORIA = {"iniciadora", "subscritora", "subscritor", "autor", "autora"}

objetivo = (item.get("objetivo") or "").strip().lower()
if objetivo not in OBJETIVO_AUTORIA:
    print(f"INFO objetivo nao-autoria ignorado: {ident} — objetivo={objetivo!r}")
    continue
```

---

### Melhorias no front-end (sem impacto na ingestão)

**4 métricas linkáveis no card do parlamentar:**
O `PainelAtuacao` passou de 4 cards estáticos para 6 cards clicáveis (Câmara) / 4
(Senado), cada um linkando para a aba e filtro correspondente via URL params:
- `?aba=projetos` → total de proposições
- `?aba=projetos&filtro=primeiro-autor` → como 1º autor (Câmara apenas)
- `?aba=projetos&filtro=aprovadas` → aprovadas
- `?aba=projetos&filtro=aprovadas-primeiro-autor` → aprovadas como 1º autor (Câmara apenas)
- `?aba=despesas` → CEAP

**Gráfico de colunas por ano em `ListaProposicoes`:**
Adicionado gráfico `recharts` acima dos filtros mostrando total de proposições por ano.
Clicar em uma coluna ativa o filtro de ano; clicar novamente desfaz. Colunas do ano
selecionado ficam em azul escuro; as demais ficam em cinza.

**Filtro de situação dos deputados em Exercício:**
Coluna `situacao` adicionada ao tipo `Parlamentar` em `types/index.ts`. Front filtra
`.eq("situacao", "Exercício")` para Câmara tanto na listagem quanto no contador da home.

---

## 2026-07-22 — Feature de presença parlamentar (Fase 4)

Implementação completa da Fase 4 do roadmap (§6.17 do CLAUDE.MD): ingestão e exibição
de dados de presença para deputados (Câmara) e senadores, com identificação das fontes,
desenvolvimento dos scripts, schema, front-end e resolução de múltiplos bugs de API.

---

### Fontes de dados utilizadas

#### Câmara dos Deputados — API v2

| Endpoint | Uso |
|---|---|
| `GET /deputados?idLegislatura={N}` | Lista base de deputados ativos (referência para calcular ausências nominais) |
| `GET /eventos?dataInicio=&dataFim=` | Eventos no período — filtrados por `situacao` encerrada |
| `GET /eventos/{id}/deputados` | Lista de presentes em cada evento de comissão/plenário |
| `GET /votacoes?dataInicio=&dataFim=` | Votações nominais no período |
| `GET /votacoes/{id}/votos` | Votos individuais por votação — proxy mais confiável de presença |

**Lógica de ausência (Câmara):** Para cada votação nominal com votos registrados,
todos os deputados ativos que **não aparecem** na lista de votos são marcados como
`status_presenca = "ausente"`. Votações simbólicas (`votos = []`) não geram marcação
de ausência — a lista vazia não é informação confiável de falta.

#### Senado Federal — API Legislativa

| Endpoint | Uso |
|---|---|
| `GET /plenario/lista/tiposComparecimento` | Tabela de domínio: códigos de comparecimento (`VO`, `NCom`, `LS`…) |
| `GET /senador/lista/atual` | Cadastro de senadores em exercício |
| `GET /votacao?dataInicio=&dataFim=` | Votações nominais com votos **embutidos** no payload (diferente da Câmara, que exige chamada extra) |

**Diferença arquitetural importante:** O endpoint `/votacao` do Senado retorna
cada votação já com o array `votos[]` dentro do payload — evita uma chamada extra
por votação. Limite de 1 ano por chamada (parâmetro `dataInicio`/`dataFim`).

---

### Arquivos criados

| Arquivo | Descrição |
|---|---|
| `ingestao/scripts/ingestao_presenca_camara.py` | Script de presença — Câmara |
| `ingestao/scripts/ingestao_presenca_senadores.py` | Script de presença — Senado |
| `db/schema_presenca.sql` | DDL idempotente com 7 tabelas + 2 views + RLS + índices |
| `web/src/app/[casa]/[id]/presenca/page.tsx` | Subpágina de presença (KPI bar + tabela paginada) |

**Tabelas criadas no banco:**
- Câmara: `evento_camara`, `presenca_evento_camara`, `votacao_camara`, `voto_camara`
- Senado: `tipo_comparecimento_senado`, `votacao_senado`, `voto_senado`

**Views criadas para o front-end** (JOIN necessário para filtro por data):
- `voto_camara_enriquecido` — junta `voto_camara` + `votacao_camara` para expor `data_hora`
- `voto_senado_enriquecido` — junta `voto_senado` + `votacao_senado` para expor `data_sessao`

**Front-end:** KPI "Presença" na página de detalhe saiu de `N/D` hardcoded para
percentual real (últimos 12 meses). Aba "Presença" adicionada ao `TabsNav`.

---

### Problema 10 — `siglaVotoParlamentar` retorna descrição em vez de código

**Sintoma:** Após primeira ingestão, o front-end exibia praticamente todos os
senadores como "Ausente" mesmo em votações onde votaram.

**Investigação:** O campo `siglaVotoParlamentar` no payload da API retorna o
**texto de descrição** ("Votou", "Não Compareceu"), não o **código curto** ("VO", "NCom")
como o nome do campo sugere. Além disso, `descricaoVotoParlamentar` vinha como `null`.

Fluxo com o bug:
```
siglaVotoParlamentar = "Votou"
↓
mapa_categoria.get("Votou") → None    ← "Votou" não estava em _CATEGORIA_ESTATICA (só "VO")
↓
_inferir_categoria(descricaoVotoParlamentar or "")
= _inferir_categoria("")              ← descrição é null, passa string vazia
↓
fallback conservador → "ausente_nao_justificado"   ← TODOS os votos ficavam "ausente"
```

**Solução:** Três camadas de correção aplicadas:

1. **Mapa estático expandido** — adicionados os textos de descrição como chaves diretas:
```python
"Votou":                         "presente_votou",
"Presente no Senado Federal":    "presente_sem_voto",
"Não Compareceu":                "ausente_nao_justificado",
"Licença saúde":                 "ausente_justificado",
# ... demais textos conhecidos
```

2. **Fallback corrigido** — `_inferir_categoria` agora é chamada com o texto do próprio
campo `siglaVotoParlamentar` antes de tentar `descricaoVotoParlamentar`:
```python
# antes: _inferir_categoria(descricao_voto)   ← sempre recebia ""
# depois: _inferir_categoria(sigla) or _inferir_categoria(descricao_voto)
```
`"VOTOU" in "Votou".upper()` é `True`, retornando `"presente_votou"` corretamente.

3. **`_CATEGORIA_ESTATICA` como fallback direto** — o mapa estático era usado apenas
para construir `mapa_categoria` a partir da tabela de domínio da API. Siglas fora
da tabela de domínio (que a API pode não retornar em `/tiposComparecimento`) não
estavam disponíveis na hora do processamento dos votos.

```python
# antes:
categoria = mapa_categoria.get(sigla)

# depois (cadeia de 4 níveis):
categoria = (
    mapa_categoria.get(sigla)        # 1. tabela de domínio da API
    or _CATEGORIA_ESTATICA.get(sigla) # 2. mapa estático direto
)
if not categoria:
    categoria = _inferir_categoria(sigla) or _inferir_categoria(descricao_voto)
```

---

### Problema 11 — Siglas de voto literal não mapeadas

**Sintoma:** Warning no final da ingestão listando 11 siglas não mapeadas:
```
['AP', 'Abstenção', 'LAP', 'LP', 'LS', 'MIS', 'NCom', 'Não', 'P-NRV',
 'Presidente (art. 51 RISF)', 'Sim']
```

**Causa:** A API usa dois esquemas de codificação misturados no mesmo campo:
- Códigos de comparecimento: `AP`, `LS`, `NCom`, `P-NRV` (presença/ausência na sessão)
- Valores literais do voto: `Sim`, `Não`, `Abstenção` (o sentido do voto)

Os valores literais não constam na tabela `/tiposComparecimento`, que cobre apenas os
códigos de comparecimento. As siglas `LP` (Licença Particular) e `LAP` (Licença por
Atividade Parlamentar) também não estavam mapeadas. `Presidente (art. 51 RISF)` é
uma categoria especial do RISF para o senador que preside a sessão.

**Mapeamentos adicionados:**

| Sigla/Valor | Significado | Categoria |
|---|---|---|
| `Sim` | Votou a favor | `presente_votou` |
| `Não` | Votou contra (presente e votante) | `presente_votou` |
| `Abstenção` | Se absteve — presente e votante pelo RISF | `presente_votou` |
| `LP` | Licença Particular | `ausente_justificado` |
| `LAP` | Licença por Atividade Parlamentar | `ausente_justificado` |
| `NA` | Dispositivo não citado — código residual | `ausente_nao_justificado` |
| `Presidente (art. 51 RISF)` | Presidindo a sessão, vota só em empate | `presente_sem_voto` |

---

### Problema 12 — `_extrair_votos` não descia o nível extra do XML

**Sintoma:** Algumas votações com votos registrados na API chegavam com lista vazia
após o parse, resultando em votação registrada mas sem votos individuais.

**Causa:** Quando a API retorna estrutura XML aninhada (convertida para JSON via
`xmltodict`), a chave `Votos` contém um dict `{"Voto": [...]}` em vez de uma lista.
A função anterior fazia `ensure_list({"Voto": [...]})` que retornava
`[{"Voto": [...]}]` — uma lista de um dict, não de votos individuais.

```python
# antes (bug):
for chave in ("votos", "Votos"):
    val = vot.get(chave)
    if val is not None:
        return ensure_list(val)   # ← wrapping dict inteiro em lista

# depois (correto):
for chave_outer in ("votos", "Votos"):
    val = vot.get(chave_outer)
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        # XML aninhado: {"Votos": {"Voto": [...]}}
        for chave_inner in ("Voto", "voto"):
            inner = val.get(chave_inner)
            if inner is not None:
                return ensure_list(inner)   # ← desce o nível correto
```

---

### Problema 13 — `_extrair_lista` embrulhava dict em vez de descer mais um nível

**Sintoma:** Em algumas respostas, `fetch_votacoes_senado` retornava
`[{"Votacao": [...]}]` em vez da lista de votações.

**Causa:** A estrutura aninhada `{"VotacaoParlamentar": {"Votacoes": {"Votacao": [...]}}}` 
fazia a função encontrar a chave `"Votacoes"` com valor `{"Votacao": [...]}` (um dict) e
imediatamente embrulhá-lo em `[dict]` sem tentar descer mais um nível.

```python
# antes (bug):
if isinstance(val, dict):
    return [val]   # ← embrulhou {"Votacao": [...]} sem descer

# depois (correto):
if isinstance(val, dict):
    result = _extrair_lista(val, chaves_alvo)  # ← tenta descer primeiro
    if result:
        return result
    return [val]   # fallback: trata como item único só se recursão falhar
```

---

### Categorias de presença implementadas

#### Câmara dos Deputados

| `status_presenca` | Significado |
|---|---|
| `presente_votou` | Registrou voto na votação nominal |
| `ausente` | Não aparece na lista de votos (inferência) |

#### Senado Federal

| `categoria_presenca` | Significado |
|---|---|
| `presente_votou` | Registrou voto (Sim, Não, Abstenção, VO) |
| `presente_sem_voto` | Estava na sessão mas não votou (P-NRV, Presidente art. 51) |
| `ausente_justificado` | Ausência com justificativa aceita (LS, LP, LAP, AP, MIS…) |
| `ausente_nao_justificado` | Não compareceu sem justificativa (NCom, NA) |

**Nota de produto:** O percentual de presença exibido no front-end conta
`presente_votou` + `presente_sem_voto` como "presente" para o Senado, e apenas
`presente_votou` para a Câmara (único status disponível com certeza).

---

### Resultado da sessão

| Tabela | Registros (período 07/2025–07/2026) |
|---|---|
| `votacao_camara` | — (dependente do volume da API no período) |
| `voto_camara` | — (votações nominais × ~513 deputados por votação) |
| `votacao_senado` | — (dependente do número de sessões plenárias) |
| `voto_senado` | — (votações × ~81 senadores por votação) |
| `tipo_comparecimento_senado` | ~50 códigos de domínio |

---

### Comandos para re-ingestão

```powershell
# Forçar UTF-8 (§6.15)
$env:PYTHONIOENCODING = "utf-8"; $env:PYTHONUTF8 = "1"

# Últimos 12 meses (ajustar DATA_INICIO conforme a data atual)
$env:DATA_INICIO = "2025-07-22"
$env:DATA_FIM    = "2026-07-22"
$env:USE_CACHE   = "0"   # forçar re-download na primeira execução

cd ingestao
python scripts\ingestao_presenca_camara.py
python scripts\ingestao_presenca_senadores.py
```

**Importante:** Ao re-ingerir para corrigir categorias erradas, o `ON CONFLICT DO UPDATE`
sobrescreve os registros existentes — não é necessário limpar as tabelas antes.

---

### Pendências para próxima sessão

- [ ] Verificar volume final de registros após ingestão completa dos 12 meses
- [ ] Avaliar se o warning de "siglas desconhecidas" zerou após os fixes
- [ ] Configurar GitHub Actions para ingestão diária/semanal de presença (incrementar por semana)
- [ ] Avaliar exibição de presença em comissões (tabela `presenca_evento_camara`) no front-end
- [ ] Considerar agregar presença por mês para histórico temporal no perfil do parlamentar
