export const MOCK_PARLAMENTARES = [
  {
    id: "1", iniciais: "RC", nome: "Roberto Campos",
    partido: "PP",  uf: "BA", total: "R$ 1,68 mi", pct: 100, corHex: "#c0392b", destaque: false,
  },
  {
    id: "2", iniciais: "LM", nome: "Lúcia Martins",
    partido: "MDB", uf: "PA", total: "R$ 1,54 mi", pct: 92,  corHex: "#1351B4", destaque: false,
  },
  {
    id: "3", iniciais: "FS", nome: "Fernando Souza",
    partido: "PL",  uf: "MG", total: "R$ 1,41 mi", pct: 84,  corHex: "#1351B4", destaque: false,
  },
  {
    id: "4", iniciais: "AP", nome: "Ana Paula Reis",
    partido: "PT",  uf: "CE", total: "R$ 1,29 mi", pct: 77,  corHex: "#168821", destaque: false,
  },
  {
    id: "5", iniciais: "MA", nome: "Marina Alves",
    partido: "PDT", uf: "SP", total: "R$ 486 mil",  pct: 29,  corHex: "#168821", destaque: true,
  },
  {
    id: "6", iniciais: "CD", nome: "Carlos Dias",
    partido: "PSD", uf: "RS", total: "R$ 452 mil",  pct: 27,  corHex: "#168821", destaque: false,
  },
] as const;

export const MOCK_DETALHE = {
  comissoes: ["Comissão de Constituição e Justiça", "Comissão de Educação"],
  kpis: [
    { label: "Gasto em 2025",     valor: "R$ 486 mil", delta: "7% abaixo da média",  deltaPos: true  },
    { label: "Presença",          valor: "94%",         delta: "312 de 332 sessões", deltaPos: false },
    { label: "Proposições",       valor: "47",          delta: "8 viraram lei",       deltaPos: false },
    { label: "Ranking de gastos", valor: "312º",        delta: "de 513 deputados",   deltaPos: false },
  ],
  gastos: [
    { label: "Divulgação da atividade",  valor: "R$ 164 mil", pct: 84, cor: "#1351B4" },
    { label: "Passagens aéreas",         valor: "R$ 112 mil", pct: 57, cor: "#1351B4" },
    { label: "Manutenção de escritório", valor: "R$ 98 mil",  pct: 50, cor: "#168821" },
    { label: "Combustível",              valor: "R$ 62 mil",  pct: 32, cor: "#168821" },
    { label: "Consultorias",             valor: "R$ 50 mil",  pct: 26, cor: "#FFCD07" },
  ],
  proposicoes: [
    { titulo: "PL 2630/2024 — Marco da transparência de dados", status: "Aprovado",      data: "Mai 2025" },
    { titulo: "PL 889/2025 — Merenda escolar de origem local",  status: "Em tramitação", data: "Abr 2025" },
    { titulo: "PEC 12/2025 — Financiamento da educação básica", status: "Relatoria",     data: "Mar 2025" },
  ],
} as const;

export const MOCK_STATS = [
  { valor: "513",       cor: "text-brand-blue",      label: "Deputados federais" },
  { valor: "81",        cor: "text-brand-green",     label: "Senadores" },
  { valor: "R$ 1,2 bi", cor: "text-brand-blue-dark", label: "Em verbas 2025" },
  { valor: "28,4 mil",  cor: "text-brand-blue-dark", label: "Proposições" },
] as const;

export const MOCK_GASTOS_HOME = [
  { label: "Divulgação",       total: 18240, pct: 88, cor: "#1351B4" },
  { label: "Passagens aéreas", total: 12900, pct: 62, cor: "#1351B4" },
  { label: "Combustível",      total: 8100,  pct: 39, cor: "#168821" },
  { label: "Consultorias",     total: 5600,  pct: 27, cor: "#FFCD07" },
] as const;
