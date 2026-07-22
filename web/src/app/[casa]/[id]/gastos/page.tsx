import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/db";
import GastosMensaisChart, { type MesItem } from "@/components/GastosMensaisChart";
import GastosChart, { type GastoItem } from "@/components/GastosChart";
import type { Parlamentar, Despesa } from "@/types";

export const revalidate = 3600;

const PAGE_SIZE = 30;
const CORES_CAT = ["#1351B4", "#2563eb", "#168821", "#0d7a3e", "#FFCD07"];

const MESES_FULL = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString("pt-BR")} mil`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  }).format(v);
}

function isCnpj(s: string | null | undefined): boolean {
  return (s ?? "").replace(/\D/g, "").length === 14;
}

type SP = { ano?: string; mes?: string; natureza?: string; pagina?: string };

function buildUrl(base: string, sp: SP, overrides: Partial<SP>): string {
  const merged = { ...sp, ...overrides };
  const p = new URLSearchParams();
  if (merged.ano && merged.ano !== "2025") p.set("ano", merged.ano);
  if (merged.mes)                          p.set("mes", merged.mes);
  if (merged.natureza)                     p.set("natureza", merged.natureza);
  if (Number(merged.pagina) > 1)           p.set("pagina", String(merged.pagina));
  const qs = p.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}

type Props = {
  params: Promise<{ casa: string; id: string }>;
  searchParams: Promise<SP>;
};

export default async function GastosParPage({ params, searchParams }: Props) {
  const { casa, id } = await params;
  const { ano = "2025", mes = "", natureza = "", pagina = "1" } = await searchParams;

  const { data: parlamentar } = await supabase
    .from("parlamentar")
    .select("id, nome")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single<Pick<Parlamentar, "id" | "nome">>();

  if (!parlamentar) notFound();

  const anoNum = parseInt(ano, 10);
  const mesNum = mes ? parseInt(mes, 10) : null;
  const page = Math.max(1, parseInt(pagina, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Queries paralelas: dados para gráficos (ano inteiro) + tabela paginada com filtros
  let tableQ = supabase
    .from("despesa")
    .select("*", { count: "exact" })
    .eq("parlamentar_id", parlamentar.id)
    .eq("ano", anoNum);
  if (mesNum)    tableQ = tableQ.eq("mes", mesNum);
  if (natureza)  tableQ = tableQ.eq("natureza", natureza);

  const [{ data: chartRaw }, { data: tableRaw, count }] = await Promise.all([
    supabase
      .from("despesa")
      .select("mes, natureza, valor_liquido")
      .eq("parlamentar_id", parlamentar.id)
      .eq("ano", anoNum)
      .limit(500),
    tableQ
      .order("mes", { ascending: false })
      .order("valor_liquido", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ]);

  type ChartRow = { mes: number; natureza: string | null; valor_liquido: number | null };
  const chartData = (chartRaw ?? []) as ChartRow[];
  const despesas = (tableRaw ?? []) as Despesa[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // KPIs (ano inteiro, sem filtro de mes/natureza)
  const totalGasto = chartData.reduce((s, d) => s + (d.valor_liquido ?? 0), 0);
  const totalLancamentos = chartData.length;
  const maiorDespesa = chartData.reduce((m, d) => Math.max(m, d.valor_liquido ?? 0), 0);
  const mesesAtivos = new Set(chartData.map((d) => d.mes)).size;

  // Dados do gráfico mensal
  const mesTotais: Record<number, number> = {};
  for (const d of chartData) {
    mesTotais[d.mes] = (mesTotais[d.mes] ?? 0) + (d.valor_liquido ?? 0);
  }
  const mesItems: MesItem[] = Object.entries(mesTotais).map(([m, t]) => ({
    mes: Number(m), total: t,
  }));

  // Top 5 categorias
  const catTotais: Record<string, number> = {};
  for (const d of chartData) {
    const key = d.natureza ?? "Outros";
    catTotais[key] = (catTotais[key] ?? 0) + (d.valor_liquido ?? 0);
  }
  const catItems: GastoItem[] = Object.entries(catTotais)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, t], i) => ({ label, total: t, cor: CORES_CAT[i] ?? "#1351B4" }));

  // Naturezas para o filtro (extraídas dos dados do ano)
  const naturezas = [...new Set(chartData.map((d) => d.natureza).filter(Boolean))].sort() as string[];

  const base = `/${casa}/${id}/gastos`;
  const sp: SP = { ano, mes, natureza, pagina };

  // Janela de paginação
  const winStart = Math.max(1, page - 1);
  const winPages: number[] = [];
  for (let i = winStart; i <= Math.min(winStart + 2, totalPages); i++) winPages.push(i);

  const kpis = [
    { label: "Total gasto",    valor: totalGasto > 0 ? formatBRL(totalGasto) : "—",       delta: `ano ${ano}` },
    { label: "Lançamentos",    valor: totalLancamentos.toLocaleString("pt-BR"),             delta: "registros no período" },
    { label: "Maior despesa",  valor: maiorDespesa > 0 ? formatBRL(maiorDespesa) : "—",    delta: "em um único lançamento" },
    { label: "Meses com gasto",valor: mesesAtivos > 0 ? `${mesesAtivos} de 12` : "—",     delta: "meses no ano" },
  ];

  return (
    <>
      {/* KPIs */}
      <div className="border-b border-border-base">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 sm:grid-cols-4">
          {kpis.map(({ label, valor, delta }, i) => (
            <div key={label} className={`px-4 sm:px-[26px] py-5 sm:py-6 ${i < 3 ? "sm:border-r border-border-base" : ""}`}>
              <div className="text-[13px] text-text-body font-semibold mb-1.5">{label}</div>
              <div className="text-[26px] font-extrabold text-brand-blue-dark">{valor}</div>
              <div className="text-xs font-semibold mt-1 text-text-body">{delta}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-8">
        {totalGasto === 0 ? (
          <p className="py-16 text-center text-text-muted">
            Nenhum gasto registrado para {ano}.
          </p>
        ) : (
          <>
            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 mb-10">
              <div>
                <h2 className="text-[18px] font-extrabold text-text-strong mb-4">
                  Gastos mensais — {ano}
                </h2>
                <GastosMensaisChart data={mesItems} />
              </div>
              {catItems.length > 0 && (
                <div>
                  <h2 className="text-[18px] font-extrabold text-text-strong mb-4">
                    Distribuição por categoria
                  </h2>
                  <GastosChart data={catItems} />
                </div>
              )}
            </div>

            {/* Filtros */}
            <form
              method="GET"
              action={`/${casa}/${id}/gastos`}
              className="flex gap-3 flex-wrap mb-6 items-center"
            >
              <select
                name="ano"
                defaultValue={ano}
                className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
              >
                {["2025", "2024", "2023"].map((a) => (
                  <option key={a} value={a}>Ano: {a}</option>
                ))}
              </select>

              <select
                name="mes"
                defaultValue={mes}
                className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
              >
                <option value="">Mês: Todos</option>
                {MESES_FULL.map((m, i) => (
                  <option key={i + 1} value={String(i + 1)}>{m}</option>
                ))}
              </select>

              <select
                name="natureza"
                defaultValue={natureza}
                className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
              >
                <option value="">Tipo: Todos</option>
                {naturezas.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>

              <button
                type="submit"
                className="bg-brand-blue text-white rounded-lg px-5 py-[11px] text-sm font-bold hover:bg-[#0d3d96] transition-colors"
              >
                Aplicar
              </button>
            </form>

            {/* Cabeçalho da tabela */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[18px] font-extrabold text-text-strong">
                Lançamentos
                {mes ? ` — ${MESES_FULL[parseInt(mes) - 1]}` : ""}
                {natureza ? ` — ${natureza}` : ""}
              </h2>
              <span className="text-[13px] text-text-muted">
                {total.toLocaleString("pt-BR")} lançamento{total !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Tabela */}
            <div className="border border-border-base rounded-lg overflow-hidden">
              {/* Cabeçalho — oculto em mobile */}
              <div className="hidden sm:grid grid-cols-[70px_1.5fr_1.8fr_110px_44px] gap-4 px-4 py-3 bg-surface-alt text-xs font-bold text-text-body uppercase tracking-[0.03em]">
                <span>Mês</span>
                <span>Tipo de despesa</span>
                <span>Fornecedor</span>
                <span>Valor</span>
                <span />
              </div>

              {despesas.length === 0 ? (
                <div className="px-4 py-10 text-center text-text-muted text-sm">
                  Nenhum lançamento para os filtros selecionados.
                </div>
              ) : (
                <div className="divide-y divide-border-base">
                  {despesas.map((d, i) => {
                    const docLink = d.url_documento ? (
                      <a
                        href={d.url_documento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:opacity-70 transition-opacity"
                        title="Ver documento"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    ) : null;

                    const fornecedorEl = isCnpj(d.cpf_cnpj) ? (
                      <Link
                        href={`/fornecedor/${(d.cpf_cnpj ?? "").replace(/\D/g, "")}`}
                        className="text-[13px] text-brand-blue font-semibold hover:underline leading-snug"
                      >
                        {d.fornecedor ?? "—"}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-text-strong font-semibold leading-snug">
                        {d.fornecedor ?? "—"}
                      </span>
                    );

                    return (
                      <div key={d.id ?? i}>
                        {/* Layout mobile — card */}
                        <div className="sm:hidden px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-text-muted uppercase">
                                  {MESES_FULL[(d.mes ?? 1) - 1]?.slice(0, 3)}
                                </span>
                                <span className="text-[11px] text-text-muted">·</span>
                                <p className="text-[13px] font-semibold text-text-strong leading-snug truncate">
                                  {d.natureza ?? "—"}
                                </p>
                              </div>
                              <div className="mt-1">{fornecedorEl}</div>
                              {d.detalhamento && (
                                <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{d.detalhamento}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[13px] font-bold text-text-strong">
                                {formatBRL(d.valor_liquido ?? 0)}
                              </p>
                              {(d.valor_glosa ?? 0) > 0 && (
                                <p className="text-[11px] text-danger">glosa: {formatBRL(d.valor_glosa!)}</p>
                              )}
                              {docLink && <div className="mt-1 flex justify-end">{docLink}</div>}
                            </div>
                          </div>
                        </div>

                        {/* Layout desktop — grid */}
                        <div className="hidden sm:grid grid-cols-[70px_1.5fr_1.8fr_110px_44px] gap-4 px-4 py-3 items-start">
                          <span className="text-[13px] text-text-body font-semibold pt-0.5">
                            {MESES_FULL[(d.mes ?? 1) - 1]?.slice(0, 3)}
                          </span>
                          <div>
                            <p className="text-[13px] font-semibold text-text-strong leading-snug">{d.natureza ?? "—"}</p>
                            {d.detalhamento && (
                              <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{d.detalhamento}</p>
                            )}
                          </div>
                          <div>
                            {fornecedorEl}
                            {d.cpf_cnpj && <p className="text-[11px] text-text-muted mt-0.5">{d.cpf_cnpj}</p>}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-text-strong">{formatBRL(d.valor_liquido ?? 0)}</p>
                            {(d.valor_glosa ?? 0) > 0 && (
                              <p className="text-[11px] text-danger mt-0.5">glosa: {formatBRL(d.valor_glosa!)}</p>
                            )}
                          </div>
                          <div className="flex justify-center pt-0.5">{docLink}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-5">
                <span className="text-[13px] text-text-muted">
                  Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de{" "}
                  {total.toLocaleString("pt-BR")}
                </span>
                <nav className="flex gap-1.5">
                  <PagBtn
                    href={buildUrl(base, sp, { pagina: String(page - 1) })}
                    disabled={page <= 1}
                    label="‹"
                    active={false}
                  />
                  {winPages.map((pg) => (
                    <PagBtn
                      key={pg}
                      href={buildUrl(base, sp, { pagina: String(pg) })}
                      label={String(pg)}
                      active={pg === page}
                    />
                  ))}
                  <PagBtn
                    href={buildUrl(base, sp, { pagina: String(page + 1) })}
                    disabled={page >= totalPages}
                    label="›"
                    active={false}
                  />
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function PagBtn({
  href, label, active, disabled,
}: {
  href: string; label: string; active: boolean; disabled?: boolean;
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
