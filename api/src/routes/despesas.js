'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

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
