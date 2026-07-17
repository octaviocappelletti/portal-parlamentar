# Implementação da Página de Fornecedores

> Documentação das decisões, dificuldades e soluções da sessão de desenvolvimento da feature de fornecedores do Portal Parlamentar.

---

## O que foi implementado

### Visão geral

Uma nova rota `/fornecedor/[cnpj]` que exibe, para cada fornecedor identificado por CNPJ, o total de recursos recebidos via CEAP e a lista completa de parlamentares que o contrataram — com drill-down em cada lançamento individual.

### Arquivos criados ou modificados

| Arquivo | Tipo | O que mudou |
|---|---|---|
| `db/schema.sql` | modificado | Tabela `fornecedor`, coluna gerada `cnpj_normalizado`, índices |
| `web/src/types/index.ts` | modificado | Interface `Fornecedor` adicionada |
| `web/src/app/fornecedor/[cnpj]/page.tsx` | criado | Rota SSR da página do fornecedor |
| `web/src/components/ParlamentaresFornecedor.tsx` | criado | Componente client com acordeão de parlamentares |
| `web/src/components/TabelaCotas.tsx` | modificado | Nome do fornecedor virou link clicável |
| `web/src/components/ListaProposicoes.tsx` | modificado | Correção de erros de tipagem do recharts (pré-existentes) |

---

## Fase 1 — Dados existentes (sem nova ingestão)

A decisão mais importante da feature foi entregar a página completa **usando apenas a tabela `despesa` já populada**, sem precisar da Receita Federal. Isso foi possível porque:

- `despesa.fornecedor` já guarda o nome do fornecedor.
- `despesa.cpf_cnpj` já guarda o CNPJ/CPF.
- `despesa.parlamentar_id` já vincula ao parlamentar.

O CNPJ na URL (`/fornecedor/12345678000190`) serve como chave de lookup direto na tabela.

### Estrutura da página (`/fornecedor/[cnpj]`)

```
Header          — nome do fornecedor, CNPJ formatado, badges da Receita (Fase 2)
Stats (3 cards) — total recebido, nº de parlamentares, nº de lançamentos
Histórico       — barra horizontal por ano (HTML puro, server component)
Acordeão        — um item por parlamentar; expande para tabela de lançamentos
```

### Componente acordeão (`ParlamentaresFornecedor`)

Componente client (`"use client"`) extraído da página para habilitar o estado de abertura/fechamento dos itens sem comprometer o SSR do restante da página. Segue o mesmo padrão visual do `TabelaCotas`: cabeçalho com foto, nome, partido/UF, contagem e total; tabela interna com categoria, mês/ano, valor reembolsado, valor glosado e link para o documento oficial.

### Link na `TabelaCotas`

O nome do fornecedor na tabela de despesas do parlamentar vira `<Link>` condicionalmente: apenas quando `cpf_cnpj` resolve para 14 dígitos (CNPJ). CPF (11 dígitos) e campos vazios continuam como `<span>`.

### Fase 2 — Enriquecimento com Receita Federal (concluída)

A tabela `fornecedor` foi populada com dados da Receita Federal via o script `ingestao/scripts/ingestao_fornecedores.py`. Ver seção "Fase 2" abaixo para detalhes completos.

---

## Dificuldades encontradas e soluções adotadas

### 1. Formato de CNPJ divergente entre as APIs

**Problema:** a API da Câmara retorna `cnpjCpfFornecedor` como dígitos puros (`12345678000190`), enquanto a API do Senado retorna `cpfCnpj` com pontuação (`12.345.678/0001-90`). Com isso:

- O regex `/^\d{14}$/` testado diretamente em `cpf_cnpj` não identificava CNPJs do Senado como clicáveis.
- O `eq("cpf_cnpj", cnpj)` na página do fornecedor não retornava registros do Senado, pois o CNPJ da URL (dígitos puros) não batia com o valor armazenado (com pontuação).

**Solução:** coluna gerada no Postgres que normaliza `cpf_cnpj` para dígitos puros em todas as linhas, existentes e futuras:

```sql
ALTER TABLE despesa ADD COLUMN cnpj_normalizado TEXT
  GENERATED ALWAYS AS (regexp_replace(cpf_cnpj, '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_despesa_cnpj_normalizado ON despesa(cnpj_normalizado);
```

No `TabelaCotas`, o href normaliza no cliente antes de montar a URL:
```typescript
const cnpj = (d.cpf_cnpj ?? "").replace(/\D/g, "");
return cnpj.length === 14 ? <Link href={`/fornecedor/${cnpj}`}> : <span>
```

A query da página passa a usar `.eq("cnpj_normalizado", cnpj)`, que funciona para ambas as casas independentemente do formato original.

### 2. Erro 404 silencioso quando a coluna não existia

**Problema:** enquanto a migration de `cnpj_normalizado` não havia sido aplicada no Supabase, a query `.eq("cnpj_normalizado", cnpj)` retornava `{ data: null, error: ... }`. O código original apenas testava `!despesasRaw?.length`, o que tratava o erro de banco como "nenhum registro encontrado" e disparava `notFound()` — resultando em 404 enganoso.

**Solução:** verificar `error` explicitamente antes de verificar `data`:

```typescript
const { data: despesasRaw, error: errDespesas } = await supabase.from("despesa")...
if (errDespesas) throw new Error(errDespesas.message); // → 500 com mensagem real
if (!despesasRaw?.length) notFound();                  // → 404 apenas se realmente vazio
```

### 3. Volume da Receita Federal vs tier gratuito do banco

**Problema:** o dataset completo da Receita Federal tem ~30 GB descomprimidos (dezenas de milhões de CNPJs). Ingerir tudo seria inviável no tier gratuito do Supabase/Neon (500 MB–1 GB).

**Solução planejada para a Fase 2:** abordagem de *reverse lookup* — extrair os CNPJs únicos presentes na tabela `despesa` (no máximo algumas dezenas de milhares) e, ao varrer os arquivos da Receita, gravar apenas as linhas que batem. O resultado final na tabela `fornecedor` caberá em poucos MB.

### 4. URL de download dos arquivos da Receita Federal — padrão errado

**Problema:** a URL documentada no padrão Nextcloud `/index.php/s/{token}/download?path=...&files=...` retornava HTTP 200 com body vazio (0 bytes), gerando um arquivo zip inválido e `zipfile.BadZipFile` na abertura. O padrão `?path=%2F2026-07` resultava em 200+vazio; `?path=%2F2026%2F07` resultava em 404.

**Diagnóstico:** ao inspecionar o conteúdo do arquivo baixado (`b''`) e testar variações de URL, ficou claro que o endpoint `/download?path=&files=` não está funcional neste share. A solução foi usar a API WebDAV nativa do Nextcloud, que é o protocolo correto para acesso programático a shares públicos.

**Solução:** autenticação Basic com o token do share como usuário e senha vazia, via endpoint `/public.php/webdav/`:

```python
import base64
RF_TOKEN = "YggdBLfdninEJX9"
RF_AUTH  = base64.b64encode(f"{RF_TOKEN}:".encode()).decode()

url = f"https://arquivos.receitafederal.gov.br/public.php/webdav/{RF_MES}/{arquivo}.zip"
headers = {"Authorization": f"Basic {RF_AUTH}"}
```

A listagem do share via `PROPFIND` com `Depth: 1` confirmou a estrutura de pastas por mês (`2023-05/` a `2026-07/`) e os nomes exatos dos arquivos antes de iniciar os downloads.

### 5. Erros de tipagem pré-existentes bloqueando o build

**Problema:** três erros de TypeScript em `TabelaCotas.tsx` e `ListaProposicoes.tsx` (assinaturas incompatíveis com os tipos do recharts `Formatter` e `BarMouseEvent`) impediam o build de passar, o que teria bloqueado o deploy da nova feature.

**Solução:** corrigidos junto com a feature:

```typescript
// Antes (tipo 'number' rejeita 'undefined' do recharts)
formatter={(v: number) => [BRL0.format(v), "total"]}

// Depois
formatter={(v) => [BRL0.format(Number(v)), "total"]}
```

```typescript
// Antes
const handleBarClick = (data: { ano: number }) => { ... }

// Depois
const handleBarClick = (data: unknown) => {
  const ano = (data as { ano: number }).ano;
  ...
}
```

---

## Fase 2 — Enriquecimento com Receita Federal

### Visão geral

Implementação completa do enriquecimento de fornecedores com dados abertos da Receita Federal do Brasil. O pipeline faz *reverse lookup*: em vez de ingerir os ~60 milhões de CNPJs do dataset completo, extrai apenas os CNPJs presentes em `despesa.cnpj_normalizado` (~46 mil) e filtra os arquivos da RF em busca deles.

**Resultado da primeira execução (julho 2026):**
- 45.980 fornecedores gravados na tabela `fornecedor`
- 96.537 sócios gravados na tabela `fornecedor_socio`
- 6 CNPJs não encontrados na RF (inválidos ou removidos do cadastro — ignorados)

### Arquivos criados ou modificados

| Arquivo | Tipo | O que mudou |
|---|---|---|
| `db/schema.sql` | modificado | 7 novas colunas em `fornecedor` + tabela `fornecedor_socio` com RLS, grant e índice |
| `web/src/types/index.ts` | modificado | `Fornecedor` ampliado; `FornecedorSocio` e `CnaeItem` adicionados |
| `web/src/app/fornecedor/[cnpj]/page.tsx` | reescrito | Seções novas: Situação, Classificação, Endereço, CNAEs, Quadro societário |
| `ingestao/lib/db.py` | modificado | `upsert_fornecedor` e `replace_fornecedor_socios` adicionados |
| `ingestao/scripts/ingestao_fornecedores.py` | criado | Script de ingestão da Receita Federal |

### Novas colunas em `fornecedor`

```sql
motivo_situacao_cadastral   TEXT     -- ex: "Omissão de declarações"
cnae_principal_descricao    TEXT     -- ex: "Desenvolvimento de programas de computador"
cnae_secundarios            JSONB    -- [{codigo, descricao}, ...]
natureza_juridica_codigo    CHAR(4)  -- ex: "2062"
natureza_juridica_descricao TEXT     -- ex: "Sociedade Empresária Limitada"
opcao_simples               BOOLEAN  -- regime Simples Nacional
opcao_mei                   BOOLEAN  -- MEI (subconjunto do Simples)
```

### Nova tabela `fornecedor_socio`

```sql
CREATE TABLE fornecedor_socio (
  id                       SERIAL PRIMARY KEY,
  fornecedor_cnpj          CHAR(14) REFERENCES fornecedor(cnpj) ON DELETE CASCADE,
  nome                     TEXT,
  identificador_socio      CHAR(1),  -- '1'=PJ '2'=PF '3'=Estrangeiro
  qualificacao_codigo      CHAR(2),
  qualificacao_descricao   TEXT,
  data_entrada_sociedade   DATE,
  faixa_etaria             CHAR(1),
  cpf_representante_legal  TEXT      -- mascarado na fonte (LGPD)
);
```

A idempotência é garantida por `DELETE WHERE fornecedor_cnpj = %s` antes de cada re-inserção, já que não há chave única natural confiável nos dados da RF.

### Estrutura do script de ingestão

O script processa os arquivos na seguinte ordem, usando cache em disco para evitar re-downloads:

```
[1] CNPJs alvo       → SELECT DISTINCT cnpj_normalizado FROM despesa
[2] Domínios         → Cnaes · Naturezas · Qualificacoes · Motivos · Municipios (em memória)
[3] Estabelecimentos → endereço, CNAE, situação cadastral (filtra por CNPJ completo 14d)
[4] Empresas         → razão social, natureza jurídica, capital, porte (filtra por cnpj_basico 8d)
[5] Simples          → opcao_simples / opcao_mei (filtra por cnpj_basico)
[6] Socios           → quadro societário (filtra por cnpj_basico)
    COMMIT único
```

Cache: `.cache/receita_federal/{RF_MES}_{arquivo}.zip`. Re-execução não re-baixa nada.

### Layout dos arquivos CSV da Receita Federal

Encoding Latin-1, separador `;`, sem header, campos texto entre aspas.

| Arquivo | Colunas relevantes (índice 0-based) |
|---|---|
| Estabelecimentos | 0-2: cnpj_basico+ordem+dv · 4: nome_fantasia · 5-7: situação+data+motivo · 10-12: data_inicio+cnae_princ+cnae_sec · 13-20: endereço |
| Empresas | 0: cnpj_basico · 1: razao_social · 2: nat_juridica · 4: capital · 5: porte |
| Socios | 0: cnpj_basico · 1: id_socio · 2: nome · 3: cpf_cnpj · 4: qualificacao · 5: data_entrada · 10: faixa_etaria |
| Simples | 0: cnpj_basico · 1: opcao_simples (S/N) · 4: opcao_mei (S/N) |
| Domínios | 0: codigo · 1: descricao |

### Novos campos exibidos na página do fornecedor

| Seção | Fonte |
|---|---|
| Header: badges de Natureza jurídica e Simples/MEI | `fornecedor` |
| Situação: data + motivo + idade da empresa + capital social | `fornecedor` |
| Classificação: natureza jurídica, porte, regime tributário | `fornecedor` |
| Endereço: logradouro, bairro, município/UF, CEP formatado | `fornecedor` |
| Atividades (CNAE): principal com descrição + secundárias | `fornecedor` |
| Quadro societário: nome, tipo, qualificação, data de entrada, faixa etária | `fornecedor_socio` |

A query à `fornecedor_socio` tem fallback silencioso (`errSocios ? [] : socios`) — se a tabela não existir no banco, a seção simplesmente não aparece.

---

## Dificuldades encontradas e soluções adotadas (Fase 2)

### Server component + client component separados

A página `/fornecedor/[cnpj]` é server component (SSR, `revalidate = 86400`). Apenas o acordeão de parlamentares foi extraído como client component (`ParlamentaresFornecedor`), pois precisa de `useState` para controlar quais itens estão abertos. Isso mantém o header, os stats e o gráfico de anos no servidor, reduzindo o JS enviado ao browser.

### CNPJ como identificador de rota

O CNPJ (14 dígitos numéricos) foi escolhido como parâmetro de rota porque é o único identificador estável e único de um fornecedor — o nome pode ter grafias diferentes entre registros. A rota valida o formato com `/^\d{14}$/` antes de qualquer query e retorna 404 para CPFs (11 dígitos) ou formatos inválidos.

### Dados da Receita Federal são opcionais em runtime

A query à tabela `fornecedor` usa `.maybeSingle()` — retorna `null` sem erro quando o CNPJ ainda não foi enriquecido. Os badges do header simplesmente não aparecem. Isso permite que a página funcione em produção antes da Fase 2 ser implementada.

### 6. Colunas novas não aplicadas no Supabase antes do primeiro upsert

**Problema:** o script processou com sucesso todos os arquivos (45 min de download + parsing) e travou apenas na hora de gravar, com `psycopg.errors.UndefinedColumn: column "motivo_situacao_cadastral" of relation "fornecedor" does not exist`. As migrações `ALTER TABLE` tinham sido omitidas na aplicação ao Supabase.

**Solução:** como todos os arquivos já estavam em cache local, bastou rodar as migrações no SQL Editor e re-executar o script. A re-execução levou apenas alguns minutos (sem re-download). Lição: aplicar sempre as migrações de schema **antes** de rodar o script de ingestão.

---

## Decisões de arquitetura (Fase 2)

### Reverse lookup em vez de ingestão completa

O dataset da Receita Federal tem ~60 milhões de estabelecimentos (~30 GB descomprimidos). A abordagem de reverse lookup — extrair os CNPJs do banco e filtrar ao varrer os arquivos — reduz o resultado final a ~46 mil linhas na tabela `fornecedor`, cabendo em poucos MB no tier gratuito do Supabase.

### Cache por mês no disco

Cada arquivo é nomeado `{RF_MES}_{arquivo}.zip` (ex.: `2026-07_Empresas0.zip`). Isso permite:
- Re-execução sem re-download (idempotência de rede)
- Manter múltiplos meses em cache para auditar diferenças
- Forçar re-download apagando apenas os arquivos do mês desejado

### Sócios: DELETE + INSERT em vez de ON CONFLICT

O quadro societário não tem chave única confiável na fonte (mesmo sócio pode ter qualificações trocadas, datas corrigidas retroativamente). A estratégia `DELETE WHERE fornecedor_cnpj = %s` + re-inserção garante idempotência sem depender de uma chave composta frágil.

### CPF de sócios: apenas referência parcial

O campo `cpf_representante_legal` armazena o CPF já mascarado pela própria Receita Federal (três primeiros dígitos e dois verificadores ocultos, conforme LGPD). Não é exibido como identificador completo na UI — serve apenas como referência parcial de que o sócio é pessoa física.

---

## Próximos passos

1. Adicionar `ingestao_fornecedores.py` ao workflow `ingest.yml` (rodar após `ingestao_despesas.py` e `ingestao_despesas_senadores.py`, pois depende de `despesa` populada).
2. Atualizar mensalmente: basta rodar o script com `RF_MES` do mês corrente — o cache do mês anterior permanece intocado.
