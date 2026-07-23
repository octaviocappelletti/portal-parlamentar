import { notFound } from "next/navigation";
import { supabase } from "@/lib/db";
import type { VotoCamaraEnriquecido, VotoSenadoEnriquecido } from "@/types";

export const revalidate = 3600;

const PAGE_SIZE = 50;

// ─── Badges ──────────────────────────────────────────────────────────────────

const BADGE_CAMARA: Record<string, { label: string; cls: string }> = {
  presente_votou: { label: "Presente",  cls: "bg-green-bg text-brand-green" },
  ausente:        { label: "Ausente",   cls: "bg-red-50 text-red-600" },
};

const BADGE_SENADO: Record<string, { label: string; cls: string }> = {
  presente_votou:          { label: "Presente",           cls: "bg-green-bg text-brand-green" },
  presente_sem_voto:       { label: "Presente s/ voto",   cls: "bg-yellow-bg text-yellow-text" },
  ausente_justificado:     { label: "Ausente (justif.)",  cls: "bg-yellow-bg text-yellow-text" },
  ausente_nao_justificado: { label: "Ausente",            cls: "bg-red-50 text-red-600" },
};

function badgeCamara(status: string | null | undefined) {
  const b = BADGE_CAMARA[status ?? ""] ?? { label: status ?? "—", cls: "bg-surface-alt text-text-body" };
  return <span className={`text-[11px] font-bold px-[9px] py-1 rounded-[6px] ${b.cls}`}>{b.label}</span>;
}

function badgeSenado(categoria: string | null | undefined) {
  const b = BADGE_SENADO[categoria ?? ""] ?? { label: categoria ?? "—", cls: "bg-surface-alt text-text-body" };
  return <span className={`text-[11px] font-bold px-[9px] py-1 rounded-[6px] ${b.cls}`}>{b.label}</span>;
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function dateFrom12MonthsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Paginação ────────────────────────────────────────────────────────────────

function PagBtn({ href, label, active, disabled }: {
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
    <a
      href={href}
      className={`w-[34px] h-[34px] flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
        active
          ? "bg-brand-blue text-white"
          : "border border-border-input text-[#33404f] hover:bg-surface-alt"
      }`}
    >
      {label}
    </a>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ casa: string; id: string }>;
  searchParams: Promise<{ pagina?: string }>;
};

export default async function PresencaPage({ params, searchParams }: Props) {
  const { casa, id } = await params;
  const { pagina = "1" } = await searchParams;

  if (casa !== "camara" && casa !== "senado") notFound();

  const page = Math.max(1, parseInt(pagina, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const dataFrom = dateFrom12MonthsAgo();
  const idNum = Number(id);

  // ── Câmara ──────────────────────────────────────────────────────────────────
  if (casa === "camara") {
    const [
      { count: totalCount },
      { count: presenteCount },
      { data: rows, count: tableCount },
    ] = await Promise.all([
      supabase
        .from("voto_camara_enriquecido")
        .select("*", { count: "exact", head: true })
        .eq("id_deputado", idNum)
        .gte("data_hora", dataFrom),
      supabase
        .from("voto_camara_enriquecido")
        .select("*", { count: "exact", head: true })
        .eq("id_deputado", idNum)
        .eq("status_presenca", "presente_votou")
        .gte("data_hora", dataFrom),
      supabase
        .from("voto_camara_enriquecido")
        .select("*", { count: "exact" })
        .eq("id_deputado", idNum)
        .gte("data_hora", dataFrom)
        .order("data_hora", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ]);

    const total = totalCount ?? 0;
    const presente = presenteCount ?? 0;
    const ausente = total - presente;
    const pct = total > 0 ? Math.round((presente / total) * 100) : null;
    const votos = (rows ?? []) as VotoCamaraEnriquecido[];
    const totalPages = Math.ceil((tableCount ?? 0) / PAGE_SIZE);
    const winStart = Math.max(1, page - 1);
    const winPages: number[] = [];
    for (let i = winStart; i <= Math.min(winStart + 2, totalPages); i++) winPages.push(i);

    const basePag = `/${casa}/${id}/presenca`;

    if (total === 0) {
      return (
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-16 text-center text-text-muted">
          Nenhuma votação nominal registrada nos últimos 12 meses.
        </div>
      );
    }

    return (
      <>
        {/* KPIs */}
        <div className="border-b border-border-base">
          <div className="max-w-[1180px] mx-auto grid grid-cols-2 sm:grid-cols-4">
            {[
              { label: "Votações nominais", valor: total.toLocaleString("pt-BR"),    delta: "últimos 12 meses" },
              { label: "Presente",          valor: presente.toLocaleString("pt-BR"), delta: "votações com voto registrado", pos: true },
              { label: "Ausente",           valor: ausente.toLocaleString("pt-BR"),  delta: "sem voto registrado" },
              { label: "% Presença",        valor: pct !== null ? `${pct}%` : "—",   delta: "votações nominais", pos: pct !== null && pct >= 75 },
            ].map(({ label, valor, delta, pos }, i) => (
              <div key={label} className={`px-4 sm:px-[26px] py-5 sm:py-6 ${i < 3 ? "sm:border-r border-border-base" : ""}`}>
                <div className="text-[13px] text-text-body font-semibold mb-1.5">{label}</div>
                <div className="text-[26px] font-extrabold text-brand-blue-dark">{valor}</div>
                <div className={`text-xs font-semibold mt-1 ${pos ? "text-brand-green" : "text-text-body"}`}>{delta}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-extrabold text-text-strong">Votações nominais</h2>
            <span className="text-[13px] text-text-muted">{(tableCount ?? 0).toLocaleString("pt-BR")} registros</span>
          </div>

          <div className="border border-border-base rounded-lg overflow-hidden">
            {/* Cabeçalho desktop */}
            <div className="hidden sm:grid grid-cols-[120px_1fr_110px_130px] gap-4 px-4 py-3 bg-surface-alt text-xs font-bold text-text-body uppercase tracking-[0.03em]">
              <span>Data</span>
              <span>Votação</span>
              <span>Voto</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-border-base">
              {votos.map((v, i) => (
                <div key={`${v.votacao_id}-${i}`}>
                  {/* Mobile */}
                  <div className="sm:hidden px-4 py-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="text-[11px] text-text-muted font-semibold">{formatData(v.data_hora)}</span>
                      {badgeCamara(v.status_presenca)}
                    </div>
                    <p className="text-sm text-text-strong font-semibold leading-snug line-clamp-2">
                      {v.descricao_votacao ?? v.votacao_id}
                    </p>
                    {v.tipo_voto && (
                      <p className="text-xs text-text-body mt-1">Voto: <strong>{v.tipo_voto}</strong></p>
                    )}
                    {v.sigla_orgao && (
                      <p className="text-[11px] text-text-muted mt-0.5">{v.sigla_orgao}</p>
                    )}
                  </div>

                  {/* Desktop */}
                  <div className="hidden sm:grid grid-cols-[120px_1fr_110px_130px] gap-4 px-4 py-3 items-start">
                    <div>
                      <p className="text-[13px] text-text-body font-semibold">{formatData(v.data_hora)}</p>
                      {v.sigla_orgao && <p className="text-[11px] text-text-muted mt-0.5">{v.sigla_orgao}</p>}
                    </div>
                    <p className="text-[13px] text-text-strong font-semibold leading-snug line-clamp-2">
                      {v.descricao_votacao ?? v.votacao_id}
                    </p>
                    <p className="text-[13px] text-text-body font-semibold">{v.tipo_voto ?? "—"}</p>
                    <div>{badgeCamara(v.status_presenca)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-5">
              <span className="text-[13px] text-text-muted">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, tableCount ?? 0)} de {(tableCount ?? 0).toLocaleString("pt-BR")}
              </span>
              <nav className="flex gap-1.5">
                <PagBtn href={`${basePag}?pagina=${page - 1}`} disabled={page <= 1} label="‹" active={false} />
                {winPages.map((pg) => (
                  <PagBtn key={pg} href={`${basePag}?pagina=${pg}`} label={String(pg)} active={pg === page} />
                ))}
                <PagBtn href={`${basePag}?pagina=${page + 1}`} disabled={page >= totalPages} label="›" active={false} />
              </nav>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Senado ──────────────────────────────────────────────────────────────────
  const [
    { count: totalCount },
    { count: presenteCount },
    { data: rows, count: tableCount },
  ] = await Promise.all([
    supabase
      .from("voto_senado_enriquecido")
      .select("*", { count: "exact", head: true })
      .eq("codigo_parlamentar", idNum)
      .gte("data_sessao", dataFrom),
    supabase
      .from("voto_senado_enriquecido")
      .select("*", { count: "exact", head: true })
      .eq("codigo_parlamentar", idNum)
      .in("categoria_presenca", ["presente_votou", "presente_sem_voto"])
      .gte("data_sessao", dataFrom),
    supabase
      .from("voto_senado_enriquecido")
      .select("*", { count: "exact" })
      .eq("codigo_parlamentar", idNum)
      .gte("data_sessao", dataFrom)
      .order("data_sessao", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ]);

  const total = totalCount ?? 0;
  const presente = presenteCount ?? 0;
  const ausente = total - presente;
  const pct = total > 0 ? Math.round((presente / total) * 100) : null;
  const votos = (rows ?? []) as VotoSenadoEnriquecido[];
  const totalPages = Math.ceil((tableCount ?? 0) / PAGE_SIZE);
  const winStart = Math.max(1, page - 1);
  const winPages: number[] = [];
  for (let i = winStart; i <= Math.min(winStart + 2, totalPages); i++) winPages.push(i);

  const basePag = `/${casa}/${id}/presenca`;

  if (total === 0) {
    return (
      <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-16 text-center text-text-muted">
        Nenhuma votação nominal registrada nos últimos 12 meses.
      </div>
    );
  }

  return (
    <>
      {/* KPIs */}
      <div className="border-b border-border-base">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Votações nominais", valor: total.toLocaleString("pt-BR"),    delta: "últimos 12 meses" },
            { label: "Presente",          valor: presente.toLocaleString("pt-BR"), delta: "votou ou estava presente", pos: true },
            { label: "Ausente",           valor: ausente.toLocaleString("pt-BR"),  delta: "justificado ou não" },
            { label: "% Presença",        valor: pct !== null ? `${pct}%` : "—",   delta: "votações nominais", pos: pct !== null && pct >= 75 },
          ].map(({ label, valor, delta, pos }, i) => (
            <div key={label} className={`px-4 sm:px-[26px] py-5 sm:py-6 ${i < 3 ? "sm:border-r border-border-base" : ""}`}>
              <div className="text-[13px] text-text-body font-semibold mb-1.5">{label}</div>
              <div className="text-[26px] font-extrabold text-brand-blue-dark">{valor}</div>
              <div className={`text-xs font-semibold mt-1 ${pos ? "text-brand-green" : "text-text-body"}`}>{delta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold text-text-strong">Votações nominais</h2>
          <span className="text-[13px] text-text-muted">{(tableCount ?? 0).toLocaleString("pt-BR")} registros</span>
        </div>

        <div className="border border-border-base rounded-lg overflow-hidden">
          {/* Cabeçalho desktop */}
          <div className="hidden sm:grid grid-cols-[110px_120px_1fr_110px_160px] gap-4 px-4 py-3 bg-surface-alt text-xs font-bold text-text-body uppercase tracking-[0.03em]">
            <span>Data</span>
            <span>Matéria</span>
            <span>Descrição</span>
            <span>Voto</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-border-base">
            {votos.map((v, i) => (
              <div key={`${v.codigo_sessao_votacao}-${i}`}>
                {/* Mobile */}
                <div className="sm:hidden px-4 py-3">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <span className="text-[11px] text-text-muted font-semibold">{formatData(v.data_sessao)}</span>
                    {badgeSenado(v.categoria_presenca)}
                  </div>
                  {v.identificacao && (
                    <p className="text-xs text-brand-blue font-bold mb-0.5">{v.identificacao}</p>
                  )}
                  <p className="text-sm text-text-strong font-semibold leading-snug line-clamp-2">
                    {v.descricao_votacao ?? "—"}
                  </p>
                  {v.sigla_voto && (
                    <p className="text-xs text-text-body mt-1">Voto: <strong>{v.sigla_voto}</strong></p>
                  )}
                </div>

                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-[110px_120px_1fr_110px_160px] gap-4 px-4 py-3 items-start">
                  <p className="text-[13px] text-text-body font-semibold">{formatData(v.data_sessao)}</p>
                  <p className="text-[13px] text-brand-blue font-bold">{v.identificacao ?? "—"}</p>
                  <p className="text-[13px] text-text-strong font-semibold leading-snug line-clamp-2">
                    {v.descricao_votacao ?? "—"}
                  </p>
                  <p className="text-[13px] text-text-body font-semibold">{v.sigla_voto ?? "—"}</p>
                  <div>{badgeSenado(v.categoria_presenca)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-5">
            <span className="text-[13px] text-text-muted">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, tableCount ?? 0)} de {(tableCount ?? 0).toLocaleString("pt-BR")}
            </span>
            <nav className="flex gap-1.5">
              <PagBtn href={`${basePag}?pagina=${page - 1}`} disabled={page <= 1} label="‹" active={false} />
              {winPages.map((pg) => (
                <PagBtn key={pg} href={`${basePag}?pagina=${pg}`} label={String(pg)} active={pg === page} />
              ))}
              <PagBtn href={`${basePag}?pagina=${page + 1}`} disabled={page >= totalPages} label="›" active={false} />
            </nav>
          </div>
        )}
      </div>
    </>
  );
}
