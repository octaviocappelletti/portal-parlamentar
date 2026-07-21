import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/db";
import ProposicoesAnoChart, { type AnoItem } from "@/components/ProposicoesAnoChart";
import type { Parlamentar, Proposicao } from "@/types";

export const revalidate = 3600;

const PAGE_SIZE = 20;

const TIPOS = ["PL", "PEC", "PLS", "PDL", "PLN", "PLC", "PLP", "MPV"];

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  "Aprovado":       { bg: "#e7f4ea", text: "#168821" },
  "Em tramitação":  { bg: "#fef9e7", text: "#7d5a00" },
  "Arquivado":      { bg: "#eef2f7", text: "#54606e" },
};

function resolveStatus(p: Pick<Proposicao, "aprovada" | "situacao">): string {
  if (p.aprovada) return "Aprovado";
  if (/arquiv/i.test(p.situacao ?? "")) return "Arquivado";
  return "Em tramitação";
}

function formatData(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

type SP = { tipo?: string; status?: string; ano?: string; pagina?: string };

function buildUrl(base: string, sp: SP, overrides: Partial<SP>): string {
  const merged = { ...sp, ...overrides };
  const p = new URLSearchParams();
  if (merged.tipo)                  p.set("tipo",   merged.tipo);
  if (merged.status)                p.set("status", merged.status);
  if (merged.ano)                   p.set("ano",    merged.ano);
  if (Number(merged.pagina) > 1)    p.set("pagina", String(merged.pagina));
  const qs = p.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}

type Props = {
  params: Promise<{ casa: string; id: string }>;
  searchParams: Promise<SP>;
};

export default async function ProposicoesParPage({ params, searchParams }: Props) {
  const { casa, id } = await params;
  const { tipo = "", status = "", ano = "", pagina = "1" } = await searchParams;

  const { data: parlamentar } = await supabase
    .from("parlamentar")
    .select("id, nome")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single<Pick<Parlamentar, "id" | "nome">>();

  if (!parlamentar) notFound();

  const page = Math.max(1, parseInt(pagina, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Dados leves para KPIs e gráfico (todas as proposições do parlamentar)
  let tableQ = supabase
    .from("proposicao")
    .select("*", { count: "exact" })
    .eq("parlamentar_id", parlamentar.id);

  if (tipo)   tableQ = tableQ.eq("tipo", tipo);
  if (ano)    tableQ = tableQ.eq("ano", parseInt(ano, 10));
  if (status === "aprovadas")  tableQ = tableQ.eq("aprovada", true);
  if (status === "arquivadas") tableQ = tableQ.ilike("situacao", "%arquiv%");
  if (status === "tramitacao") tableQ = tableQ.eq("aprovada", false).or("situacao.is.null,situacao.not.ilike.%arquiv%");

  type LightProp = Pick<Proposicao, "ano" | "tipo" | "aprovada" | "situacao" | "autor_principal">;

  const [{ data: allRaw }, { data: tableRaw, count }] = await Promise.all([
    supabase
      .from("proposicao")
      .select("ano, tipo, aprovada, situacao, autor_principal")
      .eq("parlamentar_id", parlamentar.id)
      .limit(2000),
    tableQ
      .order("data_apresentacao", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ]);

  const allProps = (allRaw ?? []) as LightProp[];
  const propsPagina = (tableRaw ?? []) as Proposicao[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // KPIs (globais — sem filtro)
  const totalGlobal = allProps.length;
  const aprovadasGlobal = allProps.filter((p) => p.aprovada).length;
  const arquivadasGlobal = allProps.filter((p) => /arquiv/i.test(p.situacao ?? "")).length;
  const tramitacaoGlobal = totalGlobal - aprovadasGlobal - arquivadasGlobal;

  // Gráfico: proposições por ano
  const anoCount: Record<number, number> = {};
  for (const p of allProps) {
    if (p.ano) anoCount[p.ano] = (anoCount[p.ano] ?? 0) + 1;
  }
  const anoItems: AnoItem[] = Object.entries(anoCount)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([a, t]) => ({ ano: Number(a), total: t }));

  // Anos disponíveis para o filtro (decrescente)
  const anosDisponiveis = [...new Set(allProps.map((p) => p.ano).filter(Boolean))]
    .sort((a, b) => (b ?? 0) - (a ?? 0)) as number[];

  const base = `/${casa}/${id}/proposicoes`;
  const sp: SP = { tipo, status, ano, pagina };

  // Janela de paginação
  const winStart = Math.max(1, page - 1);
  const winPages: number[] = [];
  for (let i = winStart; i <= Math.min(winStart + 2, totalPages); i++) winPages.push(i);

  const kpis = [
    { label: "Proposições",   valor: totalGlobal.toLocaleString("pt-BR"),       cor: "#071d41" },
    { label: "Aprovadas",     valor: aprovadasGlobal.toLocaleString("pt-BR"),    cor: "#168821" },
    { label: "Em tramitação", valor: tramitacaoGlobal.toLocaleString("pt-BR"),   cor: "#1351B4" },
    { label: "Arquivadas",    valor: arquivadasGlobal.toLocaleString("pt-BR"),   cor: "#54606e" },
  ];

  return (
    <>
      {/* KPIs */}
      <div className="border-b border-border-base">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 sm:grid-cols-4">
          {kpis.map(({ label, valor, cor }, i) => (
            <div key={label} className={`px-[26px] py-6 ${i < 3 ? "sm:border-r border-border-base" : ""}`}>
              <div className="text-[13px] text-text-body font-semibold mb-1.5">{label}</div>
              <div className="text-[26px] font-extrabold" style={{ color: cor }}>{valor}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-8 py-8">
        {/* Gráfico por ano */}
        {anoItems.length > 1 && (
          <div className="mb-10">
            <h2 className="text-[18px] font-extrabold text-text-strong mb-4">
              Proposições por ano
            </h2>
            <div className="max-w-[680px]">
              <ProposicoesAnoChart data={anoItems} />
            </div>
          </div>
        )}

        {/* Filtros */}
        <form
          method="GET"
          action={`/${casa}/${id}/proposicoes`}
          className="flex gap-3 flex-wrap mb-6 items-center"
        >
          <select
            name="tipo"
            defaultValue={tipo}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Tipo: Todos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            name="status"
            defaultValue={status}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Status: Todos</option>
            <option value="aprovadas">Aprovadas</option>
            <option value="tramitacao">Em tramitação</option>
            <option value="arquivadas">Arquivadas</option>
          </select>

          <select
            name="ano"
            defaultValue={ano}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-[11px] text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Ano: Todos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={String(a)}>{a}</option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-brand-blue text-white rounded-lg px-5 py-[11px] text-sm font-bold hover:bg-[#0d3d96] transition-colors"
          >
            Aplicar
          </button>
        </form>

        {/* Contagem */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold text-text-strong">
            Proposições
          </h2>
          <span className="text-[13px] text-text-muted">
            {total.toLocaleString("pt-BR")} resultado{total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Lista */}
        {propsPagina.length === 0 ? (
          <p className="py-16 text-center text-text-muted">
            Nenhuma proposição encontrada para os filtros selecionados.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {propsPagina.map((p) => {
                const statusStr = resolveStatus(p);
                const badge = STATUS_BADGE[statusStr] ?? { bg: "#eef2f7", text: "#54606e" };
                const titulo = `${p.tipo} ${p.numero}/${p.ano}`;
                return (
                  <div key={p.id} className="border border-border-base rounded-[10px] p-4">
                    {/* Header do card */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-[11px] font-bold px-[9px] py-1 rounded-[6px]"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {statusStr}
                      </span>
                      {p.autor_principal === false && (
                        <span className="text-[11px] font-bold px-[9px] py-1 rounded-[6px] bg-surface-alt text-text-muted">
                          Coautor
                        </span>
                      )}
                      {p.data_apresentacao && (
                        <span className="text-[12px] text-text-muted">
                          {formatData(p.data_apresentacao)}
                        </span>
                      )}
                      <span className="ml-auto text-[13px] font-bold text-text-strong shrink-0">
                        {titulo}
                      </span>
                    </div>

                    {/* Ementa */}
                    {p.ementa && (
                      <p className="text-[13px] text-text-body leading-snug line-clamp-2 mb-3">
                        {p.ementa}
                      </p>
                    )}

                    {/* Rodapé */}
                    {p.url_inteiro_teor && (
                      <a
                        href={p.url_inteiro_teor}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-brand-blue font-bold hover:underline"
                      >
                        Ver íntegra
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 pb-2">
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
