'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /despesas/categorias-ano?ano=YYYY
// Top 6 categorias por média mensal de gasto no ano (total ÷ meses com dados).
// Padrão: ano anterior ao atual (último ano completo).
router.get('/categorias-ano', async (req, res, next) => {
  try {
    let ano = req.query.ano
      ? parseInt(req.query.ano, 10)
      : new Date().getFullYear() - 1;

    const query = `
      SELECT
        natureza AS label,
        (SUM(valor_liquido) / COUNT(DISTINCT mes))::float8 AS total
      FROM despesa
      WHERE ano = $1 AND natureza IS NOT NULL
      GROUP BY natureza
      ORDER BY total DESC
      LIMIT 6`;

    let { rows } = await pool.query(query, [ano]);

    // Se não há dados para o ano solicitado, usa o mais recente com dados no banco
    if (rows.length === 0) {
      const { rows: anos } = await pool.query(
        `SELECT DISTINCT ano FROM despesa WHERE natureza IS NOT NULL ORDER BY ano DESC LIMIT 1`
      );
      if (anos.length === 0) return res.json({ ano, data: [] });
      ano = anos[0].ano;
      ({ rows } = await pool.query(query, [ano]));
    }

    res.json({ ano, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /despesas/resumo-ano?ids=1,2,3&ano=2025
// Totais de despesa_resumo_ano para um lote de parlamentar_ids.
// Usado pela página de lista (/[casa]) para colorir os cards com o gasto do ano.
router.get('/resumo-ano', async (req, res, next) => {
  try {
    const ids = (req.query.ids || '')
      .split(',')
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0);

    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    if (ids.length === 0) return res.json([]);

    const { rows } = await pool.query(
      `SELECT parlamentar_id, total
       FROM despesa_resumo_ano
       WHERE parlamentar_id = ANY($1::int[]) AND ano = $2`,
      [ids, ano]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /despesas/:id — despesa individual por id interno.
router.get('/:id([0-9]+)', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM despesa WHERE id = $1',
      [parseInt(req.params.id, 10)]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'despesa não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
