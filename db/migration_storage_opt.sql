-- Migração de otimização de armazenamento
-- Execute no Supabase SQL Editor EM ORDEM.
-- Cada bloco pode ser colado e executado separadamente se houver timeout.
-- Estimativa total de redução: ~160–180 MB (dados + índices).

-- ── 1. Corte de histórico de despesas (anteriores a 2021) ────────────────────
-- Mantém 2021-presente (5 anos). Cascade não se aplica; outras tabelas
-- não têm FK para despesa.
-- Estimativa: ~160 MB liberados (table + índices).

DELETE FROM despesa WHERE ano < 2021;

-- ── 2. Remover fornecedores sem despesas referenciadas ───────────────────────
-- Muitos CNPJs que existiam só em despesas pré-2021 ficam órfãos.
-- ON DELETE CASCADE apaga automaticamente os registros de fornecedor_socio.
-- Estimativa: reduz fornecedor em ~40–50% e fornecedor_socio proporcionalmente.

DELETE FROM fornecedor
WHERE cnpj NOT IN (
  SELECT DISTINCT cnpj_normalizado
  FROM despesa
  WHERE cnpj_normalizado IS NOT NULL
    AND length(cnpj_normalizado) = 14
);

-- ── 3. Remover votações da Câmara com mais de 13 meses ───────────────────────
-- O front-end filtra os últimos 12 meses; 13 meses dá margem de segurança.
-- ON DELETE CASCADE apaga automaticamente voto_camara (FK com cascade).

DELETE FROM votacao_camara
WHERE data_hora < (NOW() - INTERVAL '13 months');

-- ── 4. Remover eventos da Câmara com mais de 13 meses ────────────────────────
-- ON DELETE CASCADE apaga automaticamente presenca_evento_camara.

DELETE FROM evento_camara
WHERE data_hora_inicio < (NOW() - INTERVAL '13 months');

-- ── 5. Remover votações do Senado com mais de 13 meses ───────────────────────
-- ON DELETE CASCADE apaga automaticamente voto_senado.

DELETE FROM votacao_senado
WHERE data_sessao < (CURRENT_DATE - INTERVAL '13 months')::date;

-- ── 6. Devolver espaço físico ao sistema operacional ─────────────────────────
-- DELETE libera espaço lógico mas não o espaço físico de disco — só VACUUM FULL faz isso.
-- Cada VACUUM FULL precisa de lock exclusivo na tabela; execute com o site em baixo tráfego.
-- Se o SQL Editor reclamar de "cannot run inside a transaction block", cole e execute
-- cada linha de VACUUM separadamente (sem BEGIN/COMMIT ao redor).

VACUUM FULL despesa;
VACUUM FULL fornecedor;
VACUUM FULL fornecedor_socio;
VACUUM FULL voto_camara;
VACUUM FULL votacao_camara;
VACUUM FULL presenca_evento_camara;
VACUUM FULL evento_camara;
VACUUM FULL votacao_senado;
VACUUM FULL voto_senado;

-- ── Verificação pós-migração ─────────────────────────────────────────────────
-- Cole esta query depois de terminar para confirmar os novos tamanhos:
--
-- SELECT
--   relname AS tabela,
--   pg_size_pretty(pg_total_relation_size(oid)) AS tamanho_total,
--   reltuples::bigint AS linhas_estimadas
-- FROM pg_class
-- WHERE relkind = 'r'
--   AND relnamespace = 'public'::regnamespace
-- ORDER BY pg_total_relation_size(oid) DESC;
