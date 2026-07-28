'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Limites conservadores — a API não faz queries pesadas em paralelo
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Falha rápida na inicialização se o banco não estiver acessível
pool.query('SELECT 1').then(() => {
  console.log('[db] conexão com o Postgres estabelecida');
}).catch((err) => {
  console.error('[db] falha ao conectar no Postgres:', err.message);
  process.exit(1);
});

module.exports = pool;
