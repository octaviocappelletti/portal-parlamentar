-- Redes sociais e órgãos parlamentares — Câmara e Senado
-- Arquivo complementar ao schema.sql principal; idempotente, pode ser re-aplicado.

-- ── Dados adicionais de perfil ────────────────────────────────────────────────

ALTER TABLE parlamentar ADD COLUMN IF NOT EXISTS redes_sociais JSONB;  -- ["url1", "url2", ...]
ALTER TABLE parlamentar ADD COLUMN IF NOT EXISTS website        TEXT;

-- ── Órgãos e comissões ────────────────────────────────────────────────────────
-- id_orgao é TEXT para acomodar:
--   • Câmara: idOrgao numérico (ex: "2074")
--   • Senado comissoes: CodigoOrgao numérico (ex: "90")
--   • Senado cargos/liderancas: chave composta (ex: "cargo_FPE_Secretário")
--
-- Estratégia de update: REPLACE por parlamentar_id (DELETE + INSERT em cada execução).
-- Não usamos UNIQUE (parlamentar_id, id_orgao) porque o mesmo órgão pode aparecer
-- mais de uma vez (mandato anterior + atual, ou cargos diferentes).

CREATE TABLE IF NOT EXISTS parlamentar_orgao (
  id             SERIAL PRIMARY KEY,
  parlamentar_id INTEGER NOT NULL REFERENCES parlamentar(id) ON DELETE CASCADE,
  id_orgao       TEXT    NOT NULL,
  fonte          TEXT,              -- 'camara' | 'senado_comissoes' | 'senado_cargos' | 'senado_liderancas'
  nome_orgao     TEXT,
  sigla_orgao    TEXT,
  titulo         TEXT,             -- "Titular", "Suplente", "Presidente", "Líder", "Secretário"…
  cod_titulo     TEXT,             -- código ou descrição do tipo de órgão (uso varia por fonte)
  data_inicio    DATE,
  data_fim       DATE
);

ALTER TABLE parlamentar_orgao ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "leitura publica" ON parlamentar_orgao FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON parlamentar_orgao TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_parlamentar_orgao_parlamentar ON parlamentar_orgao(parlamentar_id);
CREATE INDEX IF NOT EXISTS idx_parlamentar_orgao_ativo
  ON parlamentar_orgao(parlamentar_id, data_fim);

-- View: apenas vínculos vigentes (sem data_fim ou data_fim no futuro)
CREATE OR REPLACE VIEW parlamentar_orgao_ativo AS
SELECT * FROM parlamentar_orgao
WHERE data_fim IS NULL OR data_fim >= CURRENT_DATE;

GRANT SELECT ON parlamentar_orgao_ativo TO anon, authenticated;
