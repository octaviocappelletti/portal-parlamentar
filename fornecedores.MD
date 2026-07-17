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

### Fase 2 — Enriquecimento com Receita Federal (pendente)

A tabela `fornecedor` foi criada no schema e está preparada para receber dados da Receita Federal (razão social oficial, situação cadastral, CNAE, porte, endereço). Quando populada, os badges aparecem automaticamente no header da página sem nenhuma mudança de código adicional. O script de ingestão (`ingestao/scripts/ingestao_fornecedores.py`) é o próximo passo.

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

### 4. URL de download dos arquivos da Receita Federal não confirmada

**Problema:** o portal da Receita usa Nextcloud com downloads acionados via JavaScript, impedindo capturar a URL exata de cada arquivo.

**Solução planejada para a Fase 2:** o script de ingestão deve fazer `requests.head()` no padrão suspeito antes de rodar em lote:
```
https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9/download?path=%2F2026-07&files=Empresas0.zip
```
Se o HEAD retornar 200 com `Content-Type: application/zip`, o padrão está correto.

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

## Decisões de arquitetura

### Server component + client component separados

A página `/fornecedor/[cnpj]` é server component (SSR, `revalidate = 86400`). Apenas o acordeão de parlamentares foi extraído como client component (`ParlamentaresFornecedor`), pois precisa de `useState` para controlar quais itens estão abertos. Isso mantém o header, os stats e o gráfico de anos no servidor, reduzindo o JS enviado ao browser.

### CNPJ como identificador de rota

O CNPJ (14 dígitos numéricos) foi escolhido como parâmetro de rota porque é o único identificador estável e único de um fornecedor — o nome pode ter grafias diferentes entre registros. A rota valida o formato com `/^\d{14}$/` antes de qualquer query e retorna 404 para CPFs (11 dígitos) ou formatos inválidos.

### Dados da Receita Federal são opcionais em runtime

A query à tabela `fornecedor` usa `.maybeSingle()` — retorna `null` sem erro quando o CNPJ ainda não foi enriquecido. Os badges do header simplesmente não aparecem. Isso permite que a página funcione em produção antes da Fase 2 ser implementada.

---

## Próximos passos (Fase 2)

1. Validar URL de download da Receita Federal com `requests.head()`.
2. Implementar `ingestao/scripts/ingestao_fornecedores.py` com abordagem de reverse lookup.
3. Adicionar o script ao workflow `ingest.yml` (rodar após as despesas, pois depende de `despesa` populada).
4. Testar os badges de situação cadastral, porte e localidade no header da página.
