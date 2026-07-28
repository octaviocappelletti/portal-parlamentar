'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// Retorna a data de 12 meses atrás no formato YYYY-MM-DD
function twelveMonthsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ── GET /parlamentares ────────────────────────────────────────────────────────
// Lista paginada com filtros. Retorna { data, count }.
router.get('/', async (req, res, next) => {
  try {
    const { casa, q, uf, partido, situacao } = req.query;
    const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 24, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    if (!['camara', 'senado'].includes(casa)) {
      return res.status(400).json({ error: 'parâmetro casa inválido (camara|senado)' });
    }

    const conditions = ['casa = $1'];
    const params     = [casa];
    let idx = 2;

    if (situacao) { conditions.push(`situacao = $${idx++}`); params.push(situacao); }
    if (q)        { conditions.push(`nome ILIKE $${idx++}`); params.push(`%${q}%`); }
    if (uf)       { conditions.push(`uf = $${idx++}`);       params.push(uf); }
    if (partido)  { conditions.push(`partido = $${idx++}`);  params.push(partido); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM parlamentar ${where}`, params),
      pool.query(
        `SELECT * FROM parlamentar ${where} ORDER BY nome LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({ data: dataRes.rows, count: countRes.rows[0].count });
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/partidos ────────────────────────────────────────────────
// Lista distinta de partidos para o dropdown de filtro.
router.get('/partidos', async (req, res, next) => {
  try {
    const { casa } = req.query;
    if (!['camara', 'senado'].includes(casa)) {
      return res.status(400).json({ error: 'parâmetro casa inválido (camara|senado)' });
    }
    const { rows } = await pool.query(
      `SELECT DISTINCT partido FROM parlamentar WHERE casa = $1 AND partido IS NOT NULL ORDER BY partido`,
      [casa]
    );
    res.json(rows.map(r => r.partido));
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/presenca-resumo ────────────────────────────────────────
// % de presença por id_externo (últimos 12 meses, via view presenca_resumo).
// Usado nos cards da lista de parlamentares.
router.get('/presenca-resumo', async (req, res, next) => {
  try {
    const { casa } = req.query;
    const ids = (req.query.ids || '')
      .split(',')
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0);

    if (!['camara', 'senado'].includes(casa)) {
      return res.status(400).json({ error: 'parâmetro casa inválido (camara|senado)' });
    }
    if (ids.length === 0) return res.json([]);

    const { rows } = await pool.query(
      `SELECT id_externo, pct_presenca FROM presenca_resumo WHERE casa = $1 AND id_externo = ANY($2::int[])`,
      [casa, ids]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:casa/:idExterno/presenca ──────────────────────────────
// KPIs de presença + votações paginadas (últimos 12 meses).
// Retorna { total, presente, data, count } — uma única chamada substitui 3 do Supabase.
router.get('/:casa(camara|senado)/:idExterno([0-9]+)/presenca', async (req, res, next) => {
  try {
    const casa   = req.params.casa;
    const idExt  = parseInt(req.params.idExterno, 10);
    const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 50, 0), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const from   = twelveMonthsAgo();

    if (casa === 'camara') {
      const [totalRes, presenteRes, dataRes] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS n FROM voto_camara_enriquecido WHERE id_deputado = $1 AND data_hora >= $2`,
          [idExt, from]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM voto_camara_enriquecido
           WHERE id_deputado = $1 AND data_hora >= $2 AND status_presenca = 'presente_votou'`,
          [idExt, from]
        ),
        pool.query(
          `SELECT * FROM voto_camara_enriquecido
           WHERE id_deputado = $1 AND data_hora >= $2
           ORDER BY data_hora DESC LIMIT $3 OFFSET $4`,
          [idExt, from, limit, offset]
        ),
      ]);
      const total    = totalRes.rows[0].n;
      const presente = presenteRes.rows[0].n;
      return res.json({ total, presente, data: dataRes.rows, count: total });
    }

    // senado
    const [totalRes, presenteRes, dataRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n FROM voto_senado_enriquecido WHERE codigo_parlamentar = $1 AND data_sessao >= $2`,
        [idExt, from]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM voto_senado_enriquecido
         WHERE codigo_parlamentar = $1 AND data_sessao >= $2
           AND categoria_presenca IN ('presente_votou', 'presente_sem_voto')`,
        [idExt, from]
      ),
      pool.query(
        `SELECT * FROM voto_senado_enriquecido
         WHERE codigo_parlamentar = $1 AND data_sessao >= $2
         ORDER BY data_sessao DESC LIMIT $3 OFFSET $4`,
        [idExt, from, limit, offset]
      ),
    ]);
    const total    = totalRes.rows[0].n;
    const presente = presenteRes.rows[0].n;
    res.json({ total, presente, data: dataRes.rows, count: total });
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:casa/:idExterno/orgaos ────────────────────────────────
// Órgãos e comissões ativas do parlamentar (via view parlamentar_orgao_ativo).
router.get('/:casa(camara|senado)/:idExterno([0-9]+)/orgaos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT po.id, po.id_orgao, po.nome_orgao, po.sigla_orgao, po.titulo, po.cod_titulo, po.data_inicio, po.data_fim
       FROM parlamentar_orgao_ativo po
       JOIN parlamentar p ON p.id = po.parlamentar_id
       WHERE p.casa = $1 AND p.id_externo = $2`,
      [req.params.casa, parseInt(req.params.idExterno, 10)]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:casa/:idExterno ───────────────────────────────────────
// Perfil completo do parlamentar (inclui id interno, redes_sociais, website…).
router.get('/:casa(camara|senado)/:idExterno([0-9]+)', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM parlamentar WHERE casa = $1 AND id_externo = $2`,
      [req.params.casa, parseInt(req.params.idExterno, 10)]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'parlamentar não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:id/proposicoes/sumario ────────────────────────────────
// Todos os campos leves de proposição (até 2000 linhas) para KPIs e gráfico de anos.
// Deve vir ANTES de /:id/proposicoes para não ser sombreado.
router.get('/:id([0-9]+)/proposicoes/sumario', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ano, tipo, aprovada, situacao, autor_principal
       FROM proposicao WHERE parlamentar_id = $1 LIMIT 2000`,
      [parseInt(req.params.id, 10)]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:id/proposicoes ────────────────────────────────────────
// Proposições paginadas com filtros opcionais. Retorna { data, count }.
router.get('/:id([0-9]+)/proposicoes', async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id, 10);
    const { tipo, status } = req.query;
    const ano    = req.query.ano ? parseInt(req.query.ano, 10) : null;
    const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 20, 0), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = ['parlamentar_id = $1'];
    const params     = [id];
    let idx = 2;

    if (tipo) { conditions.push(`tipo = $${idx++}`); params.push(tipo); }
    if (ano)  { conditions.push(`ano  = $${idx++}`); params.push(ano); }

    if (status === 'aprovadas') {
      conditions.push('aprovada = true');
    } else if (status === 'arquivadas') {
      conditions.push("situacao ILIKE '%arquiv%'");
    } else if (status === 'tramitacao') {
      conditions.push("aprovada = false AND (situacao IS NULL OR situacao NOT ILIKE '%arquiv%')");
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM proposicao ${where}`, params),
      pool.query(
        `SELECT * FROM proposicao ${where}
         ORDER BY data_apresentacao DESC NULLS LAST
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({ data: dataRes.rows, count: countRes.rows[0].count });
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:id/despesas/chart ─────────────────────────────────────
// Dados leves para gráficos (mes × natureza × valor). Limite 500, sem paginação.
// Deve vir ANTES de /:id/despesas para não ser sombreado.
router.get('/:id([0-9]+)/despesas/chart', async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id, 10);
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    const { rows } = await pool.query(
      `SELECT mes, natureza, valor_liquido::float8
       FROM despesa WHERE parlamentar_id = $1 AND ano = $2 LIMIT 500`,
      [id, ano]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:id/despesas/resumo ────────────────────────────────────
// Total gasto no ano via view despesa_resumo_ano.
router.get('/:id([0-9]+)/despesas/resumo', async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id, 10);
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    const { rows } = await pool.query(
      `SELECT total::float8, lancamentos FROM despesa_resumo_ano WHERE parlamentar_id = $1 AND ano = $2`,
      [id, ano]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    next(err);
  }
});

// ── GET /parlamentares/:id/despesas ───────────────────────────────────────────
// Despesas paginadas com filtros opcionais. Retorna { data, count }.
router.get('/:id([0-9]+)/despesas', async (req, res, next) => {
  try {
    const id       = parseInt(req.params.id, 10);
    const ano      = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const mes      = req.query.mes      ? parseInt(req.query.mes,      10) : null;
    const natureza = req.query.natureza || null;
    const limit    = Math.min(Math.max(parseInt(req.query.limit,  10) || 30, 0), 100);
    const offset   = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = ['parlamentar_id = $1', 'ano = $2'];
    const params     = [id, ano];
    let idx = 3;

    if (mes)      { conditions.push(`mes      = $${idx++}`); params.push(mes); }
    if (natureza) { conditions.push(`natureza = $${idx++}`); params.push(natureza); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM despesa ${where}`, params),
      pool.query(
        `SELECT * FROM despesa ${where}
         ORDER BY mes DESC, valor_liquido DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({ data: dataRes.rows, count: countRes.rows[0].count });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
