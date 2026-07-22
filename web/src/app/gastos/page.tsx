import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/db";
import AvatarFoto from "@/components/AvatarFoto";
import type { Parlamentar } from "@/types";

export const revalidate = 86400;

export const metadata: Metadata = { title: "Ranking de gastos" };

const PAGE_SIZE = 20;

const CASAS = {
  camara: { nome: "Câmara dos Deputados", cargo: "deputados federais", situacao: "Exercício" },
  senado: { nome: "Senado Federal",       cargo: "senadores",          situacao: null        },
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

function formatGasto(value: number | undefined): string {
  if (!value) return "—";
  if (value >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (value >= 1_000)
    return `R$ ${Math.round(value / 1_000).toLocaleString("pt-BR")} mil`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  }).format(value);
}

function corPosicao(pos: number, max: number): string {
  if (pos === 1)                    return "#c0392b";
  if (pos <= Math.ceil(max * 0.25)) return "#1351B4";
  return "#168821";
}

type SP = {
  casa?: string;
  q?: string;
  uf?: string;
  partido?: string;
  ano?: string;
  pagina?: string;
};

function buildUrl(sp: SP, overrides: Partial<SP>): string {
  const merged = { ...sp, ...overrides };
  const p = new URLSearchParams();
  if (merged.casa && merged.casa !== "camara") p.set("casa",    merged.casa);
  if (merged.q)                               p.set("q",       merged.q);
  if (merged.uf)                              p.set("uf",      merged.uf);
  if (merged.partido)                         p.set("partido", merged.partido);
  if (merged.ano && merged.ano !== "2025")    p.set("ano",     merged.ano);
  if (Number(merged.pagina) > 1)              p.set("pagina",  String(merged.pagina));
  const qs = p.toString();
  return `/gastos${qs ? `?${qs}` : ""}`;
}

type Props = { searchParams: Promise<SP> };

export default async function GastosPage({ searchParams }: Props) {
  const {
    casa = "camara", q = "", uf = "", partido = "",
    ano = "2025", pagina = "1",
  } = await searchParams;

  if (!(casa in CASAS)) notFound();

  const casaKey = casa as Casa;
  const { nome, cargo, situacao } = CASAS[casaKey];
  const page = Math.max(1, parseInt(pagina, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Passo 1: busca TODOS os parlamentares que batem com os filtros (apenas campos necessários)
  let idQ = supabase
    .from("parlamentar")
    .select("id, id_externo, nome, partido, uf, situacao, foto_url")
    .eq("casa", casa);
  if (situacao) idQ = idQ.eq("situacao", situacao);
  if (q)        idQ = idQ.ilike("nome", `%${q}%`);
  if (uf)       idQ = idQ.eq("uf", uf);
  if (partido)  idQ = idQ.eq("partido", partido);

  const [{ data: allParl }, { data: partidosData }] = await Promise.all([
    idQ,
    supabase.from("parlamentar").select("partido").eq("casa", casa).not("partido", "is", null),
  ]);

  const partidos = [
    ...new Set(
      (partidosData ?? [])
        .map((r: { partido: string | null }) => r.partido)
        .filter(Boolean),
    ),
  ].sort() as string[];

  // Passo 2: busca totais de gasto para esses parlamentares no ano selecionado
  const allIds = (allParl ?? []).map((p: { id: number }) => p.id);
  const { data: totaisData } = allIds.length
    ? await supabase
        .from("despesa_resumo_ano")
        .select("parlamentar_id, total")
        .in("parlamentar_id", allIds)
        .eq("ano", parseInt(ano, 10))
    : { data: [] };

  const totaisMap = new Map(
    (totaisData ?? []).map((t: { parlamentar_id: number; total: number }) => [
      t.parlamentar_id,
      t.total,
    ]),
  );

  // Passo 3: ordena globalmente por gasto DESC e pagina em JS
  const allSorted = [...(allParl ?? [])].sort(
    (a, b) => (totaisMap.get(b.id) ?? 0) - (totaisMap.get(a.id) ?? 0),
  ) as Parlamentar[];

  const total = allSorted.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const sorted = allSorted.slice(offset, offset + PAGE_SIZE);
  const maxTotal = Math.max(totaisMap.get(allSorted[0]?.id) ?? 0, 1);

  const sp: SP = { casa, q, uf, partido, ano, pagina };
  const camaraUrl = buildUrl(sp, { casa: "camara", pagina: "1" });
  const senadoUrl = buildUrl(sp, { casa: "senado", pagina: "1" });

  // Janela de paginação (3 botões centrados na página atual)
  const winStart = Math.max(1, page - 1);
  const winPages: number[] = [];
  for (let i = winStart; i <= Math.min(winStart + 2, totalPages); i++) {
    winPages.push(i);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-surface-alt border-b border-border-base">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-[14px] text-[13px] text-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-text-strong transition-colors">Início</Link>
          <span>›</span>
          <span className="text-text-strong font-semibold">Ranking de gastos</span>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-8">
        {/* Título */}
        <div className="pt-8 pb-[22px]">
          <h1 className="text-[30px] font-extrabold tracking-tight text-text-strong mb-2">
            Ranking de gastos parlamentares
          </h1>
          <p className="text-[15px] text-text-body max-w-[680px] leading-relaxed">
            Uso da cota parlamentar por {cargo} no ano de {ano}.
            Valores atualizados conforme a {nome}.
          </p>
        </div>

        {/* Toggle Câmara / Senado + filtros */}
        <form method="GET" action="/gastos" className="flex gap-3 flex-wrap pb-[22px] items-center">
          {/* Toggle casa — implementado como inputs ocultos + links visuais */}
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

          {/* Casa como input oculto para o form submit preservar a seleção atual */}
          <input type="hidden" name="casa" value={casa} />

          {/* Busca */}
          <div className="flex-1 min-w-[240px] flex items-center bg-white border-[1.5px] border-border-input rounded-lg overflow-hidden">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar parlamentar…"
              className="flex-1 px-4 py-3 text-sm text-text-strong placeholder:text-text-muted focus:outline-none bg-transparent"
            />
            <span className="px-3 text-text-muted">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </span>
          </div>

          {/* UF */}
          <select
            name="uf"
            defaultValue={uf}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-3 text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Estado: Todos</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>

          {/* Partido */}
          <select
            name="partido"
            defaultValue={partido}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-3 text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Partido: Todos</option>
            {partidos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Ano */}
          <select
            name="ano"
            defaultValue={ano}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-3 text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            {["2025", "2024", "2023"].map((a) => (
              <option key={a} value={a}>Ano: {a}</option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-brand-blue text-white rounded-lg px-5 py-3 text-sm font-bold hover:bg-[#0d3d96] transition-colors"
          >
            Aplicar
          </button>
        </form>

        {/* Tabela */}
        {sorted.length === 0 ? (
          <p className="py-16 text-center text-text-muted">
            Nenhum parlamentar encontrado para os filtros selecionados.
          </p>
        ) : (
          <div className="pb-2">
            {/* Cabeçalho — oculto em mobile */}
            <div className="hidden sm:grid grid-cols-[56px_2.4fr_1fr_1.6fr_90px] gap-4 px-4 py-3 bg-surface-alt rounded-t-lg text-xs font-bold text-text-body uppercase tracking-[0.03em]">
              <span>#</span>
              <span>Parlamentar</span>
              <span>Partido / UF</span>
              <span>Total gasto {ano}</span>
              <span />
            </div>

            <div className="border border-border-base sm:border-t-0 rounded-lg sm:rounded-t-none sm:rounded-b-lg overflow-hidden">
              {sorted.map((p, i) => {
                const pos = offset + i + 1;
                const gasto = totaisMap.get(p.id);
                const pct = gasto ? Math.round((gasto / maxTotal) * 100) : 0;
                const cor = gasto ? corPosicao(pos, total) : "#eef2f7";
                const isPrimeiro = i === 0 && page === 1;

                return (
                  <div
                    key={p.id}
                    className={[
                      i < sorted.length - 1 ? "border-b border-track" : "",
                      isPrimeiro ? "bg-surface-alt" : "",
                    ].join(" ")}
                  >
                    {/* Layout mobile — card compacto */}
                    <div className="sm:hidden px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`font-extrabold text-sm w-7 shrink-0 ${isPrimeiro ? "text-danger" : "text-text-body"}`}>
                          {pos}
                        </span>
                        <AvatarFoto
                          url={p.foto_url}
                          iniciais={iniciais(p.nome)}
                          size={36}
                          rounded="rounded-lg"
                          avatarBg={isPrimeiro ? "#1351B4" : "#e8f0fb"}
                          avatarText={isPrimeiro ? "#ffffff" : "#1351B4"}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-text-strong truncate">{p.nome}</p>
                          <p className="text-[12px] text-text-body">{p.partido ?? "—"} · {p.uf ?? "—"}</p>
                        </div>
                        <Link href={`/${casa}/${p.id_externo}`} className="text-[13px] text-brand-blue font-bold shrink-0">
                          Ver →
                        </Link>
                      </div>
                      {gasto ? (
                        <div className="mt-2.5 ml-[58px]">
                          <div className="font-bold text-sm text-text-strong mb-1">{formatGasto(gasto)}</div>
                          <div className="h-[6px] bg-track rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Layout desktop — grid */}
                    <div className="hidden sm:grid grid-cols-[56px_2.4fr_1fr_1.6fr_90px] gap-4 px-4 py-4 items-center">
                      <span className={`font-extrabold text-sm ${isPrimeiro ? "text-danger" : "text-text-body"}`}>
                        {pos}
                      </span>
                      <div className="flex items-center gap-3">
                        <AvatarFoto
                          url={p.foto_url}
                          iniciais={iniciais(p.nome)}
                          size={38}
                          rounded="rounded-lg"
                          avatarBg={isPrimeiro ? "#1351B4" : "#e8f0fb"}
                          avatarText={isPrimeiro ? "#ffffff" : "#1351B4"}
                        />
                        <span className="font-bold text-sm text-text-strong truncate">{p.nome}</span>
                      </div>
                      <span className="text-[13px] text-text-body">{p.partido ?? "—"} · {p.uf ?? "—"}</span>
                      <div>
                        <div className="font-bold text-sm text-text-strong mb-1">{formatGasto(gasto)}</div>
                        <div className="h-[7px] bg-track rounded-full overflow-hidden">
                          {gasto ? <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} /> : null}
                        </div>
                      </div>
                      <Link href={`/${casa}/${p.id_externo}`} className="text-[13px] text-brand-blue font-bold hover:underline">
                        Ver →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Paginação */}
        <div className="flex items-center justify-between pt-5 pb-8">
          <span className="text-[13px] text-text-muted">
            Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de{" "}
            {total.toLocaleString("pt-BR")} {cargo}
          </span>

          <nav className="flex gap-1.5">
            <PagBtn
              href={buildUrl(sp, { pagina: String(page - 1) })}
              disabled={page <= 1}
              label="‹"
              active={false}
            />
            {winPages.map((pg) => (
              <PagBtn
                key={pg}
                href={buildUrl(sp, { pagina: String(pg) })}
                label={String(pg)}
                active={pg === page}
              />
            ))}
            <PagBtn
              href={buildUrl(sp, { pagina: String(page + 1) })}
              disabled={page >= totalPages}
              label="›"
              active={false}
            />
          </nav>
        </div>
      </div>
    </div>
  );
}

function PagBtn({
  href,
  label,
  active,
  disabled,
}: {
  href: string;
  label: string;
  active: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="w-[34px] h-[34px] flex items-center justify-center rounded-lg border border-border-input text-text-muted text-sm opacity-40 select-none">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`w-[34px] h-[34px] flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
        active
          ? "bg-brand-blue text-white"
          : "border border-border-input text-[#33404f] hover:bg-surface-alt"
      }`}
    >
      {label}
    </Link>
  );
}
