'use strict';

require('dotenv').config();

const express   = require('express');
const morgan    = require('morgan');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

// Importar db aqui para que a verificação de conexão rode na inicialização
require('./db');

const healthRouter        = require('./routes/health');
const statsRouter         = require('./routes/stats');
const parlamentaresRouter = require('./routes/parlamentares');
const despesasRouter      = require('./routes/despesas');
const proposicoesRouter   = require('./routes/proposicoes');
const gastosRouter        = require('./routes/gastos');
const fornecedorRouter    = require('./routes/fornecedor');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Segurança ─────────────────────────────────────────────────────────────────

// CORS — permite apenas a origem da Vercel (server-to-server não envia Origin).
app.use(cors({
  origin: (origin, cb) => {
    // Sem Origin header = chamada server-to-server (Next.js SSR → API). Permitir.
    if (!origin) return cb(null, true);
    if (origin === process.env.ALLOWED_ORIGIN) return cb(null, true);
    cb(Object.assign(new Error('CORS: origem não autorizada'), { status: 403 }));
  },
  optionsSuccessStatus: 200,
}));

// Rate limiting — 100 req/min por IP.
app.use(rateLimit({
  windowMs: 60 * 1_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'muitas requisições — tente novamente em um minuto' },
}));

// Autenticação por API key — /health é isento (usado por health checks do Docker).
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_KEY) {
    return res.status(403).json({ error: 'acesso negado' });
  }
  next();
});

// ── Middlewares globais ───────────────────────────────────────────────────────

app.use(morgan('[:date[iso]] :method :url :status :response-time ms'));
app.use(express.json());

// ── Rotas ─────────────────────────────────────────────────────────────────────

app.use('/health',       healthRouter);
app.use('/stats',        statsRouter);
app.use('/parlamentares', parlamentaresRouter);
app.use('/despesas',     despesasRouter);
app.use('/proposicoes',  proposicoesRouter);
app.use('/gastos',       gastosRouter);
app.use('/fornecedor',   fornecedorRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'rota não encontrada' });
});

// ── Tratamento global de erros ────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[erro]', err);
  res.status(500).json({ error: 'erro interno do servidor' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[api] escutando em http://0.0.0.0:${PORT}`);
});
