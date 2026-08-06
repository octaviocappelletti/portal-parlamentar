import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_URL!;
const API_KEY  = process.env.API_SECRET_KEY!;

const ID_RE  = /^\d{1,10}$/;
const ANO_RE = /^20\d{2}$/;
const MAX_PAGES = 50; // limite de segurança: 50 × 100 = 5 000 registros máx.

// Proxy server-side para TabelaCotas (client component).
// Agrega todas as páginas do ano numa única resposta para o navegador.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parlamentarId = searchParams.get('parlamentarId');
  const ano = searchParams.get('ano');

  if (!parlamentarId || !ano) {
    return NextResponse.json({ error: 'parlamentarId e ano obrigatórios' }, { status: 400 });
  }

  if (!ID_RE.test(parlamentarId) || !ANO_RE.test(ano)) {
    return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 });
  }

  const PAGE = 100;
  let offset = 0;
  let pages  = 0;
  const all: unknown[] = [];

  for (;;) {
    if (pages >= MAX_PAGES) break;
    pages++;

    const res = await fetch(
      `${API_BASE}/parlamentares/${parlamentarId}/despesas?ano=${ano}&limit=${PAGE}&offset=${offset}`,
      { headers: { 'x-api-key': API_KEY } },
    );
    if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: 502 });
    const { data, count } = (await res.json()) as { data: unknown[]; count: number };
    all.push(...data);
    if (all.length >= count) break;
    offset += PAGE;
  }

  return NextResponse.json(all);
}
