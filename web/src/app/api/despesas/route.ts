import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_URL!;
const API_KEY  = process.env.API_SECRET_KEY!;

// Proxy server-side para TabelaCotas (client component).
// Agrega todas as páginas do ano numa única resposta para o navegador.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parlamentarId = searchParams.get('parlamentarId');
  const ano = searchParams.get('ano');

  if (!parlamentarId || !ano) {
    return NextResponse.json({ error: 'parlamentarId e ano obrigatórios' }, { status: 400 });
  }

  const PAGE = 100;
  let offset = 0;
  const all: unknown[] = [];

  for (;;) {
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
