'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /stats — contagens globais para a home
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM parlamentar WHERE casa = 'camara' AND situacao = 'Exercício') AS total_camara,
        (SELECT COUNT(*)::int FROM parlamentar WHERE casa = 'senado')                            AS total_senado,
        (SELECT COUNT(*)::int FROM proposicao)                                                   AS total_proposicoes,
        (SELECT COALESCE(SUM(valor_liquido)::float8, 0) FROM despesa)                           AS total_gasto
    `);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
