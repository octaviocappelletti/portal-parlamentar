import Link from "next/link";
import type { Metadata } from "next";
import { supabase } from "@/lib/db";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Proposições" };

const PAGE_SIZE = 20;

const TIPOS = ["PL", "PEC", "PLS", "PDL", "PLN", "PLC", "PLP", "MPV"];

const STATUS_BADGE: Record<string, string> = {
  Aprovado:        "bg-green-bg text-brand-green",
  "Em tramitação": "bg-yellow-bg text-yellow-text",
  Arquivado:       "bg-surface-alt text-text-body",
};

type StatusLabel = "Aprovado" | "Em tramitação" | "Arquivado";

type ProposicaoRow = {
  id: number;
  tipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
  aprovada: boolean | null;
  situacao: string | null;
  data_apresentacao: string | null;
  casa: string;
  parlamentar_id: number;
  parlamentar: {
    nome: string;
    partido: string | null;
    uf: string | null;
    casa: string;
    id_externo: number;
  } | null;
};

function resolveStatus(p: ProposicaoRow): StatusLabel {
  if (p.aprovada) return "Aprovado";
  if (/arquiv/i.test(p.situacao ?? "")) return "Arquivado";
  return "Em tramitação";
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtData(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

type SP = {
  q?: string;
  status?: string;
  tipo?: string;
  ano?: string;
  casa?: string;
  pagina?: string;
};

function buildUrl(sp: SP, overrides: Partial<SP>): string {
  const merged = { ...sp, ...overrides };
  const p = new URLSearchParams();
  if (merged.q)                         p.set("q",      merged.q);
  if (merged.status)                    p.set("status", merged.status);
  if (merged.tipo)                      p.set("tipo",   merged.tipo);
  if (merged.ano)                       p.set("ano",    merged.ano);
  if (merged.casa)                      p.set("casa",   merged.casa);
  if (Number(merged.pagina) > 1)        p.set("pagina", String(merged.pagina));
  const qs = p.toString();
  return `/proposicoes${qs ? `?${qs}` : ""}`;
}

type Props = { searchParams: Promise<SP> };

export default async function ProposicoesPage({ searchParams }: Props) {
  const {
    q = "", status = "", tipo = "",
    ano = "", casa = "", pagina = "1",
  } = await searchParams;

  const page = Math.max(1, parseInt(pagina, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Query de proposições (sem join — evita timeout em tabelas grandes)
  // count: "planned" usa EXPLAIN para estimativa em vez de full table scan
  let query = supabase
    .from("proposicao")
    .select("id, tipo, numero, ano, ementa, aprovada, situacao, data_apresentacao, casa, parlamentar_id", { count: "planned" });

  if (q)    query = query.ilike("ementa", `%${q}%`);
  if (tipo) query = query.eq("tipo", tipo);
  if (ano)  query = query.eq("ano", parseInt(ano, 10));
  if (casa) query = query.eq("casa", casa);

  if (status === "aprovadas")  query = query.eq("aprovada", true);
  if (status === "arquivadas") query = query.ilike("situacao", "%arquiv%");
  // or() inclui situacao=null (não arquivada) e situacao NOT ilike '%arquiv%'
  if (status === "tramitacao") query = query.eq("aprovada", false).or("situacao.is.null,situacao.not.ilike.%arquiv%");

  const { data: propRows, count } = await query
    .order("data_apresentacao", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const propBase = (propRows ?? []) as {
    id: number; tipo: string; numero: number; ano: number;
    ementa: string | null; aprovada: boolean | null;
    situacao: string | null; data_apresentacao: string | null;
    casa: string; parlamentar_id: number;
  }[];

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Query de parlamentares para esta página (2ª query separada — eficiente)
  const parlIds = [...new Set(propBase.map((p) => p.parlamentar_id))];
  const { data: parlRows } = parlIds.length
    ? await supabase
        .from("parlamentar")
        .select("id, nome, partido, uf, casa, id_externo")
        .in("id", parlIds)
    : { data: [] };

  const parlMap = new Map(
    (parlRows ?? []).map((p: { id: number; nome: string; partido: string | null; uf: string | null; casa: string; id_externo: number }) => [
      p.id,
      p,
    ]),
  );

  // Monta o tipo final com autor resolvido
  const proposicoes: ProposicaoRow[] = propBase.map((p) => ({
    ...p,
    parlamentar: parlMap.get(p.parlamentar_id) ?? null,
  }));

  const sp: SP = { q, status, tipo, ano, casa, pagina };

  // Chips de filtros ativos
  const chips: { label: string; url: string }[] = [];
  if (q)      chips.push({ label: `"${q}"`,                                  url: buildUrl(sp, { q: "", pagina: "1" }) });
  if (status) chips.push({ label: STATUS_LABELS[status] ?? status,           url: buildUrl(sp, { status: "", pagina: "1" }) });
  if (tipo)   chips.push({ label: tipo,                                       url: buildUrl(sp, { tipo: "", pagina: "1" }) });
  if (ano)    chips.push({ label: ano,                                        url: buildUrl(sp, { ano: "", pagina: "1" }) });
  if (casa)   chips.push({ label: casa === "camara" ? "Câmara" : "Senado",   url: buildUrl(sp, { casa: "", pagina: "1" }) });

  // Paginação
  const winStart = Math.max(1, page - 1);
  const winPages: number[] = [];
  for (let i = winStart; i <= Math.min(winStart + 2, totalPages); i++) {
    winPages.push(i);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-surface-alt border-b border-border-base">
        <div className="max-w-[1180px] mx-auto px-8 py-[14px] text-[13px] text-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-text-strong transition-colors">Início</Link>
          <span>›</span>
          <span className="text-text-strong font-semibold">Proposições</span>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-8">
        {/* Título */}
        <div className="pt-8 pb-[22px]">
          <h1 className="text-[30px] font-extrabold tracking-tight text-text-strong mb-2">
            Proposições legislativas
          </h1>
          <p className="text-[15px] text-text-body max-w-[680px] leading-relaxed">
            Projetos de lei, PECs e demais proposições apresentadas pelos parlamentares.
            Dados oficiais da Câmara dos Deputados e do Senado Federal.
          </p>
        </div>

        {/* Toolbar de filtros */}
        <form method="GET" action="/proposicoes" className="flex gap-3 flex-wrap pb-[22px] items-center">
          {/* Busca na ementa */}
          <div className="flex-1 min-w-[260px] flex items-center bg-white border-[1.5px] border-border-input rounded-lg overflow-hidden">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar na ementa…"
              className="flex-1 px-4 py-3 text-sm text-text-strong placeholder:text-text-muted focus:outline-none bg-transparent"
            />
            <span className="px-3 text-text-muted">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
          </div>

          {/* Status */}
          <select
            name="status"
            defaultValue={status}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-3 text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Status: Todos</option>
            <option value="tramitacao">Em tramitação</option>
            <option value="aprovadas">Aprovadas</option>
            <option value="arquivadas">Arquivadas</option>
          </select>

          {/* Tipo */}
          <select
            name="tipo"
            defaultValue={tipo}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-3 text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Tipo: Todos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Ano */}
          <select
            name="ano"
            defaultValue={ano}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-3 text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Ano: Todos</option>
            {["2025", "2024", "2023", "2022", "2021", "2020"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Casa */}
          <select
            name="casa"
            defaultValue={casa}
            className="border-[1.5px] border-border-input rounded-lg px-4 py-3 text-sm font-semibold text-text-strong focus:outline-none bg-white"
          >
            <option value="">Casa: Ambas</option>
            <option value="camara">Câmara</option>
            <option value="senado">Senado</option>
          </select>

          <button
            type="submit"
            className="bg-brand-blue text-white rounded-lg px-5 py-3 text-sm font-bold hover:bg-[#0d3d96] transition-colors"
          >
            Aplicar
          </button>
        </form>

        {/* Chips de filtros ativos + contagem */}
        <div className="flex items-center gap-2 flex-wrap pb-5 min-h-[28px]">
          {chips.length > 0 && (
            <span className="text-[13px] text-text-muted font-semibold">Filtros ativos:</span>
          )}
          {chips.map(({ label, url }) => (
            <Link
              key={label}
              href={url}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-bg text-brand-blue text-[12px] font-bold hover:opacity-75 transition-opacity"
            >
              {label}
              <span className="text-[10px] leading-none">✕</span>
            </Link>
          ))}
          <span className="ml-auto text-[13px] text-text-muted font-semibold">
            {total.toLocaleString("pt-BR")}{" "}
            {total === 1 ? "proposição" : "proposições"}
          </span>
        </div>

        {/* Lista de proposições */}
        {proposicoes.length === 0 ? (
          <p className="py-16 text-center text-text-muted">
            Nenhuma proposição encontrada para os filtros selecionados.
          </p>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {proposicoes.map((p) => {
              const statusLabel = resolveStatus(p);
              const autor = p.parlamentar;
              const identificacao = `${p.tipo} ${p.numero}/${p.ano}`;
              const autorUrl = autor
                ? `/${autor.casa}/${autor.id_externo}`
                : null;

              return (
                <div
                  key={p.id}
                  className="border border-border-base rounded-xl p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex gap-5 items-start">
                    {/* Conteúdo principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span
                          className={`text-[11px] font-bold px-[9px] py-1 rounded-[6px] shrink-0 ${
                            STATUS_BADGE[statusLabel] ?? "bg-surface-alt text-text-body"
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <span className="text-[13px] font-bold text-text-strong">
                          {identificacao}
                        </span>
                        {p.data_apresentacao && (
                          <span className="text-[12px] text-text-muted ml-auto shrink-0">
                            {fmtData(p.data_apresentacao)}
                          </span>
                        )}
                      </div>
                      {p.ementa ? (
                        <p className="text-[14px] text-text-body leading-snug line-clamp-2">
                          {p.ementa}
                        </p>
                      ) : (
                        <p className="text-[14px] text-text-muted italic">Sem ementa disponível.</p>
                      )}
                    </div>

                    {/* Mini-card do autor */}
                    {autor && (
                      <Link
                        href={autorUrl!}
                        className="shrink-0 flex items-center gap-2.5 border border-border-base rounded-lg px-3 py-2.5 hover:bg-surface-alt transition-colors min-w-[160px] max-w-[200px]"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-bg text-brand-blue font-extrabold text-[12px] flex items-center justify-center shrink-0 select-none">
                          {iniciais(autor.nome)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-text-strong truncate leading-tight">
                            {autor.nome.split(" ").slice(0, 2).join(" ")}
                          </p>
                          <p className="text-[11px] text-text-muted truncate">
                            {autor.partido ?? "—"} · {autor.uf ?? "—"}
                          </p>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-5 pb-8">
            <span className="text-[13px] text-text-muted">
              Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de{" "}
              {total.toLocaleString("pt-BR")} proposições
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
        )}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  tramitacao: "Em tramitação",
  aprovadas:  "Aprovadas",
  arquivadas: "Arquivadas",
};

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
