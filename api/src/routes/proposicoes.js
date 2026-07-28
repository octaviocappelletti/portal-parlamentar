'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /proposicoes — proposições globais (todas as casas) com filtros e paginação.
// Retorna { data: [...proposicao com .parlamentar embutido], count }.
// GET /proposicoes/:id — proposição individual por id interno.
router.get('/:id([0-9]+)', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM proposicao WHERE id = $1',
      [parseInt(req.params.id, 10)]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'proposição não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /proposicoes — proposições globais (todas as casas) com filtros e paginação.
router.get('/', async (req, res, next) => {
  try {
    const { q, tipo, status } = req.query;
    const ano    = req.query.ano  ? parseInt(req.query.ano,  10) : null;
    const casa   = ['camara', 'senado'].includes(req.query.casa) ? req.query.casa : null;
    const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 20, 0), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = [];
    const params     = [];
    let idx = 1;

    if (q)    { conditions.push(`ementa ILIKE $${idx++}`); params.push(`%${q}%`); }
    if (tipo) { conditions.push(`tipo = $${idx++}`);       params.push(tipo); }
    if (ano)  { conditions.push(`ano  = $${idx++}`);       params.push(ano); }
    if (casa) { conditions.push(`casa = $${idx++}`);       params.push(casa); }

    if (status === 'aprovadas') {
      conditions.push('aprovada = true');
    } else if (status === 'arquivadas') {
      conditions.push("situacao ILIKE '%arquiv%'");
    } else if (status === 'tramitacao') {
      conditions.push("aprovada = false AND (situacao IS NULL OR situacao NOT ILIKE '%arquiv%')");
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM proposicao ${where}`, params),
      pool.query(
        `SELECT id, tipo, numero, ano, ementa, aprovada, situacao, data_apresentacao, casa, parlamentar_id
         FROM proposicao ${where}
         ORDER BY data_apresentacao DESC NULLS LAST
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    const props = dataRes.rows;

    // Busca os parlamentares desta página em uma segunda query (eficiente)
    const parlIds = [...new Set(props.map(p => p.parlamentar_id))];
    let parlMap   = new Map();
    if (parlIds.length > 0) {
      const { rows: parlRows } = await pool.query(
        `SELECT id, nome, partido, uf, casa, id_externo FROM parlamentar WHERE id = ANY($1::int[])`,
        [parlIds]
      );
      parlMap = new Map(parlRows.map(p => [p.id, p]));
    }

    const data = props.map(p => ({ ...p, parlamentar: parlMap.get(p.parlamentar_id) ?? null }));

    res.json({ data, count: countRes.rows[0].count });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
