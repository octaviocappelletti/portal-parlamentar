import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/db";
import ParlamentarCard from "@/components/ParlamentarCard";
import type { Parlamentar } from "@/types";

export const revalidate = 86400;

const STEP = 24;

const CASAS = {
  camara: { nome: "Câmara dos Deputados", cargo: "Deputados federais", situacao: "Exercício" },
  senado: { nome: "Senado Federal",       cargo: "Senadores",          situacao: null        },
} as const;

type Casa = keyof typeof CASAS;

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type SP = {
  q?: string;
  uf?: string;
  partido?: string;
  ano?: string;
  mostrar?: string;
  sort?: string;
};

function buildUrl(casa: string, sp: SP, overrides: Partial<SP>): string {
  const merged = { ...sp, ...overrides };
  const p = new URLSearchParams();
  if (merged.q)                              p.set("q",       merged.q);
  if (merged.uf)                             p.set("uf",      merged.uf);
  if (merged.partido)                        p.set("partido", merged.partido);
  if (merged.ano && merged.ano !== "2025")   p.set("ano",     merged.ano);
  if (merged.sort && merged.sort !== "nome") p.set("sort",    merged.sort);
  const m = parseInt(merged.mostrar ?? String(STEP), 10);
  if (m > STEP)                              p.set("mostrar", String(m));
  const qs = p.toString();
  return `/${casa}${qs ? `?${qs}` : ""}`;
}

type Props = {
  params: Promise<{ casa: string }>;
  searchParams: Promise<SP>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { casa } = await params;
  if (!(casa in CASAS)) return {};
  const key = casa as Casa;
  return { title: `${CASAS[key].cargo} — ${CASAS[key].nome}` };
}

export default async function ListaPage({ params, searchParams }: Props) {
  const { casa } = await params;
  if (!(casa in CASAS)) notFound();

  const casaKey = casa as Casa;
  const { nome, cargo, situacao } = CASAS[casaKey];
  const {
    q = "", uf = "", partido = "",
    ano = "2025", mostrar = String(STEP), sort = "nome",
  } = await searchParams;

  const limit = Math.min(Math.max(parseInt(mostrar, 10) || STEP, STEP), 200);

  // Queries paralelas
  let baseQ = supabase.from("parlamentar").select("*", { count: "exact" }).eq("casa", casa);
  if (situacao) baseQ = baseQ.eq("situacao", situacao);
  if (q)        baseQ = baseQ.ilike("nome", `%${q}%`);
  if (uf)       baseQ = baseQ.eq("uf", uf);
  if (partido)  baseQ = baseQ.eq("partido", partido);

  const [{ data: rawList, count }, { data: partidosData }] = await Promise.all([
    baseQ.order("nome").range(0, limit - 1),
    supabase.from("parlamentar").select("partido").eq("casa", casa).not("partido", "is", null),
  ]);

  const parlamentares = (rawList ?? []) as Parlamentar[];
  const total = count ?? 0;

  const partidos = [
    ...new Set(
      (partidosData ?? [])
        .map((r: { partido: string | null }) => r.partido)
        .filter(Boolean),
    ),
  ].sort() as string[];

  // Totais de gasto para os parlamentares desta página
  const ids = parlamentares.map((p) => p.id);
  const { data: totaisData } = ids.length
    ? await supabase
        .from("despesa_resumo_ano")
        .select("parlamentar_id, total")
        .in("parlamentar_id", ids)
        .eq("ano", parseInt(ano, 10))
    : { data: [] };

  const totaisMap = new Map(
    (totaisData ?? []).map((t: { parlamentar_id: number; total: number }) => [
      t.parlamentar_id,
      t.total,
    ]),
  );

  // Ordenação client-side quando necessário
  let sorted = [...parlamentares];
  if (sort === "gasto_desc") {
    sorted.sort((a, b) => (totaisMap.get(b.id) ?? 0) - (totaisMap.get(a.id) ?? 0));
  } else if (sort === "gasto_asc") {
    sorted.sort((a, b) => (totaisMap.get(a.id) ?? 0) - (totaisMap.get(b.id) ?? 0));
  }

  // Média de gasto para colorir o indicador de "acima da média" nos cards
  const gastos = sorted.map((p) => totaisMap.get(p.id) ?? 0).filter((v) => v > 0);
  const mediaGasto = gastos.length
    ? gastos.reduce((a, b) => a + b, 0) / gastos.length
    : 0;

  // URLs para o toggle de casa (preserva filtros, reseta paginação)
  const sp: SP = { q, uf, partido, ano, mostrar: String(limit), sort };
  const camaraUrl = buildUrl("camara", sp, { mostrar: String(STEP) });
  const senadoUrl = buildUrl("senado", sp, { mostrar: String(STEP) });

  // Chips de filtros ativos
  const filtrosAtivos: { label: string; removeUrl: string }[] = [];
  if (q)       filtrosAtivos.push({ label: `"${q}"`, removeUrl: buildUrl(casa, sp, { q: "" }) });
  if (uf)      filtrosAtivos.push({ label: uf,        removeUrl: buildUrl(casa, sp, { uf: "" }) });
  if (partido) filtrosAtivos.push({ label: partido,   removeUrl: buildUrl(casa, sp, { partido: "" }) });

  const carregarMaisUrl = buildUrl(casa, sp, { mostrar: String(limit + STEP) });
  const temMais = limit < total;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-surface-alt border-b border-border-base">
        <div className="max-w-[1180px] mx-auto px-8 py-[14px] text-[13px] text-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-text-strong transition-colors">Início</Link>
          <span>›</span>
          <span className="text-text-strong font-semibold">
            {casaKey === "camara" ? "Deputados" : "Senadores"}
          </span>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-8">
        {/* Título */}
        <div className="pt-8 pb-[18px]">
          <h1 className="text-[30px] font-extrabold tracking-tight text-text-strong mb-2">
            {cargo}
          </h1>
          <p className="text-[15px] text-text-body max-w-[680px] leading-relaxed">
            Perfis e gastos de todos os {cargo.toLowerCase()} — dados da {nome}.
          </p>
        </div>

        {/* Toolbar */}
        <form method="GET" action={`/${casa}`} className="flex gap-3 flex-wrap pb-[18px] items-center">
          {/* Toggle Câmara / Senado — fora do submit, navega diretamente */}
          <div className="flex bg-surface-alt border border-border-base rounded-lg p-1 gap-1 shrink-0">
            <Link
              href={camaraUrl}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                casaKey === "camara"
                  ? "bg-brand-blue text-white"
                  : "text-text-body hover:text-text-strong"
              }`}
            >
              Câmara
            </Link>
            <Link
              href={senadoUrl}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                casaKey === "senado"
                  ? "bg-brand-blue text-white"
                  : "text-text-body hover:text-text-strong"
              }`}
            >
              Senado
            </Link>
          </div>

          {/* Busca */}
          <div className="flex-1 min-w-[220px] flex items-center bg-white border-[1.5px] border-border-input rounded-lg overflow-hidden">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar parlamentar…"
              className="flex-1 px-4 py-[11px] text-sm text-text-strong placeholder:text-text-muted focus:outline-none bg-transparent"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="px-4 text-text-muted hover:text-brand-blue transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          </div>

          {/* UF */}
          <select
            name="uf"
            defaultValue={uf}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">UF: Todas</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>

          {/* Partido */}
          <select
            name="partido"
            defaultValue={partido}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Partido: Todos</option>
            {partidos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Ordenar */}
          <select
            name="sort"
            defaultValue={sort}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="nome">Ordenar: Nome A-Z</option>
            <option value="gasto_desc">Ordenar: Maior gasto</option>
            <option value="gasto_asc">Ordenar: Menor gasto</option>
          </select>

          <button
            type="submit"
            className="bg-brand-blue text-white rounded-lg px-5 py-[11px] text-sm font-bold hover:bg-[#0d3d96] transition-colors"
          >
            Aplicar
          </button>
        </form>

        {/* Chips de filtros ativos + contagem */}
        <div className="flex items-center gap-2 flex-wrap pb-5 min-h-[28px]">
          {filtrosAtivos.length > 0 && (
            <span className="text-[13px] text-text-muted font-semibold">Filtros ativos:</span>
          )}
          {filtrosAtivos.map(({ label, removeUrl }) => (
            <Link
              key={label}
              href={removeUrl}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-bg text-brand-blue text-[12px] font-bold hover:opacity-75 transition-opacity"
            >
              {label}
              <span className="text-[10px] leading-none">✕</span>
            </Link>
          ))}
          <span className="ml-auto text-[13px] text-text-muted font-semibold">
            {total.toLocaleString("pt-BR")}{" "}
            {total === 1 ? "resultado" : "resultados"}
          </span>
        </div>

        {/* Grade de cartões */}
        {sorted.length === 0 ? (
          <p className="py-16 text-center text-text-muted">
            Nenhum parlamentar encontrado para os filtros selecionados.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px] pb-4">
            {sorted.map((p) => (
              <ParlamentarCard
                key={p.id}
                nome={p.nome}
                partido={p.partido}
                uf={p.uf}
                gasto2025={totaisMap.get(p.id) ?? null}
                mediaGasto={mediaGasto}
                situacao={p.situacao}
                iniciais={iniciais(p.nome)}
                href={`/${casa}/${p.id_externo}`}
              />
            ))}
          </div>
        )}

        {/* Carregar mais / status de paginação */}
        <div className="flex flex-col items-center gap-3 py-8">
          {temMais && (
            <Link
              href={carregarMaisUrl}
              className="border-[1.5px] border-brand-blue text-brand-blue font-bold text-sm px-6 py-3 rounded-lg hover:bg-blue-bg transition-colors"
            >
              Carregar mais {STEP} parlamentares
            </Link>
          )}
          {sorted.length > 0 && (
            <span className="text-[13px] text-text-muted">
              Mostrando {sorted.length.toLocaleString("pt-BR")} de{" "}
              {total.toLocaleString("pt-BR")} {cargo.toLowerCase()}
            </span>
          )}
          {!temMais && sorted.length > 0 && (
            <span className="text-[12px] text-text-muted">
              Todos os resultados carregados
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
