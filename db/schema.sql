-- Portal de Acompanhamento de Senadores e Deputados
-- DDL idempotente — pode ser re-aplicado sem efeitos colaterais

CREATE TABLE IF NOT EXISTS parlamentar (
  id               SERIAL PRIMARY KEY,
  casa             VARCHAR(6)   NOT NULL CHECK (casa IN ('camara', 'senado')),
  id_externo       INTEGER      NOT NULL,
  nome             TEXT         NOT NULL,
  nome_civil       TEXT,
  partido          TEXT,
  uf               CHAR(2),
  foto_url         TEXT,
  cpf              TEXT,
  data_nascimento  DATE,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (casa, id_externo)
);

CREATE TABLE IF NOT EXISTS mandato (
  id              SERIAL PRIMARY KEY,
  parlamentar_id  INTEGER NOT NULL REFERENCES parlamentar(id) ON DELETE CASCADE,
  legislatura     INTEGER NOT NULL,
  data_inicio     DATE,
  data_fim        DATE,
  UNIQUE (parlamentar_id, legislatura)
);

-- Chave de dedup: (casa, tipo, numero, ano) — §8
CREATE TABLE IF NOT EXISTS proposicao (
  id                 SERIAL PRIMARY KEY,
  parlamentar_id     INTEGER NOT NULL REFERENCES parlamentar(id) ON DELETE CASCADE,
  casa               VARCHAR(6) NOT NULL,
  tipo               TEXT       NOT NULL,
  numero             INTEGER    NOT NULL,
  ano                INTEGER    NOT NULL,
  ementa             TEXT,
  autor_principal    BOOLEAN    DEFAULT TRUE,
  situacao           TEXT,
  aprovada           BOOLEAN    DEFAULT FALSE,
  data_apresentacao  DATE,
  url_inteiro_teor   TEXT,
  fetched_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (casa, tipo, numero, ano)
);

-- Chave de dedup: (parlamentar_id, ano, mes, fornecedor, valor_liquido, documento) — §8
CREATE TABLE IF NOT EXISTS despesa (
  id              SERIAL PRIMARY KEY,
  parlamentar_id  INTEGER      NOT NULL REFERENCES parlamentar(id) ON DELETE CASCADE,
  ano             INTEGER      NOT NULL,
  mes             INTEGER      NOT NULL CHECK (mes BETWEEN 1 AND 12),
  natureza        TEXT,
  fornecedor      TEXT,
  cpf_cnpj        TEXT,
  valor_liquido   NUMERIC(12,2),
  valor_glosa     NUMERIC(12,2),
  url_documento   TEXT,
  detalhamento    TEXT,
  documento       TEXT,
  fetched_at      TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (parlamentar_id, ano, mes, fornecedor, valor_liquido, documento)
);

-- Fase 4 (§6.17) — sem fonte confiável ainda, tabela reservada
CREATE TABLE IF NOT EXISTS presenca (
  id               SERIAL PRIMARY KEY,
  parlamentar_id   INTEGER NOT NULL REFERENCES parlamentar(id) ON DELETE CASCADE,
  ano              INTEGER NOT NULL,
  mes              INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  sessoes_previstas INTEGER,
  presencas         INTEGER,
  ausencias         INTEGER,
  UNIQUE (parlamentar_id, ano, mes)
);

-- Índices para as queries mais comuns do front
CREATE INDEX IF NOT EXISTS idx_parlamentar_casa       ON parlamentar(casa);
CREATE INDEX IF NOT EXISTS idx_proposicao_parlamentar ON proposicao(parlamentar_id);
CREATE INDEX IF NOT EXISTS idx_proposicao_aprovada    ON proposicao(aprovada);
CREATE INDEX IF NOT EXISTS idx_despesa_parlamentar    ON despesa(parlamentar_id);
CREATE INDEX IF NOT EXISTS idx_despesa_ano            ON despesa(ano);
