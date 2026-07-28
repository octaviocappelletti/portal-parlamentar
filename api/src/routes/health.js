'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS db_time');
    res.json({
      status: 'ok',
      db: 'connected',
      db_time: rows[0].db_time,
      uptime_s: Math.floor(process.uptime()),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      error: err.message,
    });
  }
});

module.exports = router;
