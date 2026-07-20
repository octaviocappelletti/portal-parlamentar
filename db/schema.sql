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
  situacao         TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (casa, id_externo)
);

-- Migração para bancos existentes
ALTER TABLE parlamentar ADD COLUMN IF NOT EXISTS situacao TEXT;

CREATE TABLE IF NOT EXISTS mandato (
  id              SERIAL PRIMARY KEY,
  parlamentar_id  INTEGER NOT NULL REFERENCES parlamentar(id) ON DELETE CASCADE,
  legislatura     INTEGER NOT NULL,
  data_inicio     DATE,
  data_fim        DATE,
  UNIQUE (parlamentar_id, legislatura)
);

-- Overrides manuais de senadores — substitui os dicts hardcoded no script de ingestão.
-- tipo 'excluido'            → senador ignorado na ingestão (mandato cassado, afastado etc.)
-- tipo 'suplente_exercicio'  → suplente incluso individualmente (titular afastado/cassado)
CREATE TABLE IF NOT EXISTS override_senador (
  id_externo  INTEGER  NOT NULL,
  tipo        TEXT     NOT NULL CHECK (tipo IN ('excluido', 'suplente_exercicio')),
  motivo      TEXT,
  UNIQUE (id_externo, tipo)
);

-- Seed dos overrides vigentes em 2026-07
INSERT INTO override_senador (id_externo, tipo, motivo) VALUES
  (5929, 'excluido',           'Mandato cassado — Juíza Selma (MT)'),
  (5016, 'excluido',           'Afastado para exercer cargo de Ministro — Wellington Dias (PI)'),
  (6369, 'suplente_exercicio', 'Suplente em exercício — Jussara Lima (PI), substituindo Wellington Dias')
ON CONFLICT (id_externo, tipo) DO UPDATE SET motivo = EXCLUDED.motivo;

-- Chave de dedup: (casa, tipo, numero, ano, parlamentar_id)
-- Uma linha por (proposição × parlamentar) — permite coautorias corretamente.
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
  UNIQUE (casa, tipo, numero, ano, parlamentar_id)
);

-- Migração para bancos existentes:
-- a antiga constraint UNIQUE (casa, tipo, numero, ano) impedia co-autorias.
-- Substituir pela constraint (casa, tipo, numero, ano, parlamentar_id).
ALTER TABLE proposicao DROP CONSTRAINT IF EXISTS proposicao_casa_tipo_numero_ano_key;
ALTER TABLE proposicao ADD CONSTRAINT IF NOT EXISTS proposicao_casa_tipo_numero_ano_parlamentar_id_key
  UNIQUE (casa, tipo, numero, ano, parlamentar_id);

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

-- RLS — portal somente-leitura: libera SELECT para a chave anon do Supabase
ALTER TABLE parlamentar ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandato     ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposicao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesa     ENABLE ROW LEVEL SECURITY;
ALTER TABLE presenca    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "leitura publica" ON parlamentar FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "leitura publica" ON mandato     FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "leitura publica" ON proposicao  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "leitura publica" ON despesa     FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "leitura publica" ON presenca    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Índices para as queries mais comuns do front
CREATE INDEX IF NOT EXISTS idx_parlamentar_casa         ON parlamentar(casa);
CREATE INDEX IF NOT EXISTS idx_parlamentar_situacao     ON parlamentar(casa, situacao);
CREATE INDEX IF NOT EXISTS idx_proposicao_parlamentar   ON proposicao(parlamentar_id);
CREATE INDEX IF NOT EXISTS idx_proposicao_aprovada      ON proposicao(aprovada);
CREATE INDEX IF NOT EXISTS idx_despesa_parlamentar      ON despesa(parlamentar_id);
CREATE INDEX IF NOT EXISTS idx_despesa_ano              ON despesa(ano);
-- Índice composto essencial para o check "ano já ingerido?" e para lazy-load por ano
CREATE INDEX IF NOT EXISTS idx_despesa_parlamentar_ano  ON despesa(parlamentar_id, ano);
CREATE INDEX IF NOT EXISTS idx_despesa_cpf_cnpj         ON despesa(cpf_cnpj);
-- Coluna gerada que normaliza cpf_cnpj para dígitos puros (resolve diferença de formato
-- entre a API da Câmara, que retorna dígitos, e a do Senado, que retorna com pontuação).
ALTER TABLE despesa ADD COLUMN IF NOT EXISTS cnpj_normalizado TEXT
  GENERATED ALWAYS AS (regexp_replace(cpf_cnpj, '[^0-9]', '', 'g')) STORED;
CREATE INDEX IF NOT EXISTS idx_despesa_cnpj_normalizado ON despesa(cnpj_normalizado);

-- ── Views expostas via PostgREST ─────────────────────────────────────────────

-- Total geral de despesas (1 linha) — substitui o select("valor_liquido") da home
CREATE OR REPLACE VIEW despesa_totais AS
SELECT COALESCE(SUM(valor_liquido)::FLOAT8, 0) AS total_geral FROM despesa;

GRANT SELECT ON despesa_totais TO anon, authenticated;

-- Resumo por parlamentar × ano — alimenta a timeline de anos sem carregar N mil linhas
CREATE OR REPLACE VIEW despesa_resumo_ano AS
SELECT
  parlamentar_id,
  ano,
  COALESCE(SUM(valor_liquido)::FLOAT8, 0) AS total,
  COUNT(*)::INT                            AS lancamentos
FROM despesa
GROUP BY parlamentar_id, ano;

GRANT SELECT ON despesa_resumo_ano TO anon, authenticated;

-- ── Fornecedores (dados da Receita Federal — populados pela Fase 2 da ingestão) ─

CREATE TABLE IF NOT EXISTS fornecedor (
  id                          SERIAL PRIMARY KEY,
  cnpj                        CHAR(14)  NOT NULL UNIQUE,
  razao_social                TEXT,
  nome_fantasia               TEXT,
  situacao_cadastral          CHAR(2),
  data_situacao_cadastral     DATE,
  motivo_situacao_cadastral   TEXT,
  data_inicio_atividade       DATE,
  cnae_principal              TEXT,
  cnae_principal_descricao    TEXT,
  cnae_secundarios            JSONB,    -- [{codigo, descricao}]
  natureza_juridica_codigo    CHAR(4),
  natureza_juridica_descricao TEXT,
  porte_empresa               CHAR(2),
  capital_social              TEXT,
  opcao_simples               BOOLEAN,
  opcao_mei                   BOOLEAN,
  logradouro                  TEXT,
  numero                      TEXT,
  bairro                      TEXT,
  municipio                   TEXT,
  uf                          CHAR(2),
  cep                         CHAR(8),
  enriched_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- Migrações para bancos existentes
ALTER TABLE fornecedor ADD COLUMN IF NOT EXISTS motivo_situacao_cadastral   TEXT;
ALTER TABLE fornecedor ADD COLUMN IF NOT EXISTS cnae_principal_descricao    TEXT;
ALTER TABLE fornecedor ADD COLUMN IF NOT EXISTS cnae_secundarios            JSONB;
ALTER TABLE fornecedor ADD COLUMN IF NOT EXISTS natureza_juridica_codigo    CHAR(4);
ALTER TABLE fornecedor ADD COLUMN IF NOT EXISTS natureza_juridica_descricao TEXT;
ALTER TABLE fornecedor ADD COLUMN IF NOT EXISTS opcao_simples               BOOLEAN;
ALTER TABLE fornecedor ADD COLUMN IF NOT EXISTS opcao_mei                   BOOLEAN;

ALTER TABLE fornecedor ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "leitura publica" ON fornecedor FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON fornecedor TO anon, authenticated;

-- Quadro societário dos fornecedores
CREATE TABLE IF NOT EXISTS fornecedor_socio (
  id                       SERIAL PRIMARY KEY,
  fornecedor_cnpj          CHAR(14) NOT NULL REFERENCES fornecedor(cnpj) ON DELETE CASCADE,
  nome                     TEXT,
  identificador_socio      CHAR(1),  -- '1'=PJ  '2'=PF  '3'=Estrangeiro
  qualificacao_codigo      CHAR(2),
  qualificacao_descricao   TEXT,
  data_entrada_sociedade   DATE,
  faixa_etaria             CHAR(1),
  cpf_representante_legal  TEXT      -- já mascarado na fonte (LGPD)
);

ALTER TABLE fornecedor_socio ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "leitura publica" ON fornecedor_socio FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON fornecedor_socio TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_fornecedor_socio_cnpj ON fornecedor_socio(fornecedor_cnpj);
