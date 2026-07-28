'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /gastos — ranking global de gastos parlamentares.
// Consolida em uma única query o que o front-end atual faz em 3 chamadas sequenciais
// (parlamentares → ids → despesa_resumo_ano JOIN).
// Retorna { data: [...parlamentar com total_gasto], partidos: string[] }.
router.get('/', async (req, res, next) => {
  try {
    const { casa, q, uf, partido } = req.query;
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    if (!['camara', 'senado'].includes(casa)) {
      return res.status(400).json({ error: 'parâmetro casa inválido (camara|senado)' });
    }

    // Filtros sobre parlamentar
    const conditions = ['p.casa = $1'];
    const params     = [casa];
    let idx = 2;

    // Câmara sempre filtra por "Exercício"; Senado não tem situação obrigatória
    if (casa === 'camara') conditions.push(`p.situacao = 'Exercício'`);

    if (q)       { conditions.push(`p.nome    ILIKE $${idx++}`); params.push(`%${q}%`); }
    if (uf)      { conditions.push(`p.uf       = $${idx++}`);    params.push(uf); }
    if (partido) { conditions.push(`p.partido  = $${idx++}`);    params.push(partido); }

    // ano é o último parâmetro, usado na cláusula JOIN
    const anoIdx = idx;
    params.push(ano);

    const where = 'WHERE ' + conditions.join(' AND ');

    const [dataRes, partidosRes] = await Promise.all([
      pool.query(
        `SELECT p.id, p.id_externo, p.nome, p.partido, p.uf, p.situacao, p.foto_url,
                COALESCE(d.total::float8, 0) AS total_gasto
         FROM parlamentar p
         LEFT JOIN despesa_resumo_ano d ON d.parlamentar_id = p.id AND d.ano = $${anoIdx}
         ${where}
         ORDER BY total_gasto DESC`,
        params
      ),
      pool.query(
        `SELECT DISTINCT partido FROM parlamentar WHERE casa = $1 AND partido IS NOT NULL ORDER BY partido`,
        [casa]
      ),
    ]);

    res.json({
      data:     dataRes.rows,
      partidos: partidosRes.rows.map(r => r.partido),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
