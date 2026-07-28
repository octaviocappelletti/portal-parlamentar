'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// Valida que o CNPJ tem exatamente 14 dígitos
function validarCnpj(cnpj) {
  return /^\d{14}$/.test(cnpj);
}

// GET /fornecedor/:cnpj — dados da Receita Federal (tabela fornecedor).
// Retorna null (200) quando o CNPJ existe nas despesas mas não foi enriquecido.
router.get('/:cnpj', async (req, res, next) => {
  try {
    const { cnpj } = req.params;
    if (!validarCnpj(cnpj)) return res.status(400).json({ error: 'CNPJ inválido' });

    const { rows } = await pool.query(
      `SELECT * FROM fornecedor WHERE cnpj = $1`,
      [cnpj]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    next(err);
  }
});

// GET /fornecedor/:cnpj/despesas — todas as despesas do fornecedor com parlamentar embutido.
// Sem paginação — o front-end processa o conjunto completo para calcular totais e grupos.
router.get('/:cnpj/despesas', async (req, res, next) => {
  try {
    const { cnpj } = req.params;
    if (!validarCnpj(cnpj)) return res.status(400).json({ error: 'CNPJ inválido' });

    const { rows } = await pool.query(
      `SELECT
         d.id,
         d.parlamentar_id,
         d.ano,
         d.mes,
         d.valor_liquido::float8   AS valor_liquido,
         d.valor_glosa::float8     AS valor_glosa,
         d.natureza,
         d.fornecedor,
         d.detalhamento,
         d.url_documento,
         -- parlamentar embutido (mesmo formato que o Supabase join retornava)
         json_build_object(
           'id',         p.id,
           'id_externo', p.id_externo,
           'nome',       p.nome,
           'partido',    p.partido,
           'uf',         p.uf,
           'casa',       p.casa,
           'foto_url',   p.foto_url
         ) AS parlamentar
       FROM despesa d
       JOIN parlamentar p ON p.id = d.parlamentar_id
       WHERE d.cnpj_normalizado = $1
       ORDER BY d.ano DESC, d.mes DESC`,
      [cnpj]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /fornecedor/:cnpj/socios — quadro societário.
router.get('/:cnpj/socios', async (req, res, next) => {
  try {
    const { cnpj } = req.params;
    if (!validarCnpj(cnpj)) return res.status(400).json({ error: 'CNPJ inválido' });

    const { rows } = await pool.query(
      `SELECT * FROM fornecedor_socio WHERE fornecedor_cnpj = $1 ORDER BY data_entrada_sociedade`,
      [cnpj]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
