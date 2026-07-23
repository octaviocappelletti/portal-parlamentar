-- Presença parlamentar — tabelas para Câmara e Senado
-- Arquivo complementar ao schema.sql principal; pode ser re-aplicado de forma idempotente.

-- ── Câmara dos Deputados ──────────────────────────────────────────────────────

-- Eventos (reuniões, sessões plenárias, audiências etc.)
CREATE TABLE IF NOT EXISTS evento_camara (
  id               INTEGER     PRIMARY KEY,   -- id da API v2
  data_hora_inicio TIMESTAMPTZ,
  data_hora_fim    TIMESTAMPTZ,
  descricao_tipo   TEXT,
  situacao         TEXT,
  orgaos_siglas    TEXT[],                    -- ex: ['PLEN','CCJC']
  fetched_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Quem estava presente em cada evento (1 linha por deputado × evento)
CREATE TABLE IF NOT EXISTS presenca_evento_camara (
  evento_id   INTEGER NOT NULL REFERENCES evento_camara(id) ON DELETE CASCADE,
  id_deputado INTEGER NOT NULL,              -- id_externo de parlamentar (casa=camara)
  nome        TEXT,
  partido     TEXT,
  uf          CHAR(2),
  fetched_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (evento_id, id_deputado)
);

-- Votações nominais (apenas as que têm votos individuais registrados)
CREATE TABLE IF NOT EXISTS votacao_camara (
  id          TEXT PRIMARY KEY,              -- ex: "2637721-10"
  data_hora   TIMESTAMPTZ,
  descricao   TEXT,
  id_orgao    INTEGER,
  sigla_orgao TEXT,
  aprovacao   TEXT,
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Votos individuais + ausências marcadas (1 linha por deputado × votação)
-- status_presenca: 'presente_votou' | 'ausente'
CREATE TABLE IF NOT EXISTS voto_camara (
  votacao_id      TEXT    NOT NULL REFERENCES votacao_camara(id) ON DELETE CASCADE,
  id_deputado     INTEGER NOT NULL,
  nome            TEXT,
  partido         TEXT,
  uf              CHAR(2),
  tipo_voto       TEXT,                     -- Sim / Não / Abstenção / Obstrução / Artigo 17
  data_registro   TIMESTAMPTZ,
  status_presenca TEXT,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (votacao_id, id_deputado)
);

-- ── Senado Federal ────────────────────────────────────────────────────────────

-- Tabela de domínio: códigos de comparecimento do Senado
-- categoria: presente_votou | presente_sem_voto | ausente_justificado | ausente_nao_justificado
CREATE TABLE IF NOT EXISTS tipo_comparecimento_senado (
  sigla     TEXT PRIMARY KEY,
  descricao TEXT,
  categoria TEXT CHECK (categoria IN (
    'presente_votou',
    'presente_sem_voto',
    'ausente_justificado',
    'ausente_nao_justificado'
  ))
);

-- Votações nominais no Senado
CREATE TABLE IF NOT EXISTS votacao_senado (
  codigo_sessao_votacao INTEGER  PRIMARY KEY,
  codigo_sessao         INTEGER,
  data_sessao           DATE,
  casa_sessao           TEXT,
  codigo_materia        INTEGER,
  id_processo           TEXT,
  identificacao         TEXT,
  descricao_votacao     TEXT,
  resultado_votacao     TEXT,
  total_votos_sim       INTEGER,
  total_votos_nao       INTEGER,
  total_votos_abstencao INTEGER,
  votacao_secreta       BOOLEAN  DEFAULT FALSE,
  fetched_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Votos individuais (1 linha por senador × votação)
CREATE TABLE IF NOT EXISTS voto_senado (
  codigo_sessao_votacao INTEGER NOT NULL REFERENCES votacao_senado(codigo_sessao_votacao) ON DELETE CASCADE,
  codigo_parlamentar    INTEGER NOT NULL,
  nome_parlamentar      TEXT,
  partido               TEXT,
  uf                    CHAR(2),
  sexo                  CHAR(1),
  sigla_voto            TEXT,               -- código bruto (VO, NCom, LS ...)
  descricao_voto        TEXT,
  categoria_presenca    TEXT,               -- normalizada via tipo_comparecimento_senado
  fetched_at            TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (codigo_sessao_votacao, codigo_parlamentar)
);

-- ── RLS — leitura pública ─────────────────────────────────────────────────────

ALTER TABLE evento_camara              ENABLE ROW LEVEL SECURITY;
ALTER TABLE presenca_evento_camara     ENABLE ROW LEVEL SECURITY;
ALTER TABLE votacao_camara             ENABLE ROW LEVEL SECURITY;
ALTER TABLE voto_camara                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_comparecimento_senado ENABLE ROW LEVEL SECURITY;
ALTER TABLE votacao_senado             ENABLE ROW LEVEL SECURITY;
ALTER TABLE voto_senado                ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "leitura publica" ON evento_camara              FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "leitura publica" ON presenca_evento_camara     FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "leitura publica" ON votacao_camara             FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "leitura publica" ON voto_camara                FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "leitura publica" ON tipo_comparecimento_senado FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "leitura publica" ON votacao_senado             FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "leitura publica" ON voto_senado                FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON evento_camara              TO anon, authenticated;
GRANT SELECT ON presenca_evento_camara     TO anon, authenticated;
GRANT SELECT ON votacao_camara             TO anon, authenticated;
GRANT SELECT ON voto_camara                TO anon, authenticated;
GRANT SELECT ON tipo_comparecimento_senado TO anon, authenticated;
GRANT SELECT ON votacao_senado             TO anon, authenticated;
GRANT SELECT ON voto_senado                TO anon, authenticated;

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_presenca_evento_deputado  ON presenca_evento_camara(id_deputado);
CREATE INDEX IF NOT EXISTS idx_presenca_evento_data      ON evento_camara(data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_voto_camara_deputado      ON voto_camara(id_deputado);
CREATE INDEX IF NOT EXISTS idx_voto_camara_status        ON voto_camara(status_presenca);
CREATE INDEX IF NOT EXISTS idx_votacao_camara_data       ON votacao_camara(data_hora);
CREATE INDEX IF NOT EXISTS idx_voto_senado_parlamentar   ON voto_senado(codigo_parlamentar);
CREATE INDEX IF NOT EXISTS idx_voto_senado_categoria     ON voto_senado(categoria_presenca);
CREATE INDEX IF NOT EXISTS idx_votacao_senado_data       ON votacao_senado(data_sessao);
CREATE INDEX IF NOT EXISTS idx_votacao_senado_materia    ON votacao_senado(codigo_materia);

-- ── Views para consultas do front-end (join + filtro por data) ────────────────

CREATE OR REPLACE VIEW voto_camara_enriquecido AS
SELECT
  vc.votacao_id,
  vc.id_deputado,
  vc.nome,
  vc.partido,
  vc.uf,
  vc.tipo_voto,
  vc.status_presenca,
  vt.data_hora,
  vt.descricao      AS descricao_votacao,
  vt.sigla_orgao,
  vt.aprovacao
FROM voto_camara vc
JOIN votacao_camara vt ON vc.votacao_id = vt.id;

CREATE OR REPLACE VIEW voto_senado_enriquecido AS
SELECT
  vs.codigo_sessao_votacao,
  vs.codigo_parlamentar,
  vs.nome_parlamentar,
  vs.partido,
  vs.uf,
  vs.sigla_voto,
  vs.descricao_voto,
  vs.categoria_presenca,
  vt.data_sessao,
  vt.identificacao,
  vt.descricao_votacao,
  vt.resultado_votacao
FROM voto_senado vs
JOIN votacao_senado vt ON vs.codigo_sessao_votacao = vt.codigo_sessao_votacao;

GRANT SELECT ON voto_camara_enriquecido   TO anon, authenticated;
GRANT SELECT ON voto_senado_enriquecido   TO anon, authenticated;

-- ── Resumo de presença por parlamentar (últimos 12 meses) ─────────────────────

CREATE OR REPLACE VIEW presenca_resumo AS
SELECT
  'camara'::text          AS casa,
  id_deputado             AS id_externo,
  COUNT(*)                AS total_votacoes,
  COUNT(*) FILTER (WHERE status_presenca = 'presente_votou') AS presencas,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE status_presenca = 'presente_votou') * 100.0 / COUNT(*)
    )
    ELSE NULL
  END                     AS pct_presenca
FROM voto_camara_enriquecido
WHERE data_hora >= NOW() - INTERVAL '12 months'
GROUP BY id_deputado

UNION ALL

SELECT
  'senado'::text          AS casa,
  codigo_parlamentar      AS id_externo,
  COUNT(*)                AS total_votacoes,
  COUNT(*) FILTER (
    WHERE categoria_presenca IN ('presente_votou', 'presente_sem_voto')
  )                       AS presencas,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(
      COUNT(*) FILTER (
        WHERE categoria_presenca IN ('presente_votou', 'presente_sem_voto')
      ) * 100.0 / COUNT(*)
    )
    ELSE NULL
  END                     AS pct_presenca
FROM voto_senado_enriquecido
WHERE data_sessao >= (NOW() - INTERVAL '12 months')::date
GROUP BY codigo_parlamentar;

GRANT SELECT ON presenca_resumo TO anon, authenticated;
