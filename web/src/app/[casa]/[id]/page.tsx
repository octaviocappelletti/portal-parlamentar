import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/db";
import GastosChart, { type GastoItem } from "@/components/GastosChart";
import type { Parlamentar, Proposicao } from "@/types";

export const revalidate = 3600;

const CASAS = {
  camara: { label: "Deputados", cargo: "Deputado(a) Federal" },
  senado: { label: "Senadores", cargo: "Senador(a)" },
} as const;

type Casa = keyof typeof CASAS;

const TABS = ["Visão geral", "Gastos", "Proposições", "Votações", "Patrimônio"] as const;

const STATUS_BADGE: Record<string, string> = {
  Aprovado:        "bg-green-bg text-brand-green",
  "Em tramitação": "bg-yellow-bg text-yellow-text",
  Arquivado:       "bg-surface-alt text-text-body",
};

const CORES_GASTO = ["#1351B4", "#1351B4", "#168821", "#168821", "#FFCD07"];

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatGastoKPI(value: number): string {
  if (value >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (value >= 1_000)
    return `R$ ${Math.round(value / 1_000).toLocaleString("pt-BR")} mil`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function mapStatus(p: Proposicao): string {
  if (p.aprovada) return "Aprovado";
  if (/arquiv/i.test(p.situacao ?? "")) return "Arquivado";
  return "Em tramitação";
}

function formatData(p: Proposicao): string {
  if (!p.data_apresentacao) return "";
  return new Date(p.data_apresentacao).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

type Props = {
  params: Promise<{ casa: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { casa, id } = await params;
  const { data } = await supabase
    .from("parlamentar")
    .select("nome")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single();
  return { title: (data as { nome?: string } | null)?.nome ?? "Parlamentar" };
}

export default async function DetalhePage({ params }: Props) {
  const { casa, id } = await params;
  if (!(casa in CASAS)) notFound();

  const casaKey = casa as Casa;
  const { label, cargo } = CASAS[casaKey];

  const { data: parlamentar } = await supabase
    .from("parlamentar")
    .select("*")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single<Parlamentar>();

  if (!parlamentar) notFound();

  const ANO = 2025;

  const [
    { data: proposicoes },
    { data: despesasCat },
    { data: resumo },
    { count: totalProps },
  ] = await Promise.all([
    supabase
      .from("proposicao")
      .select("*")
      .eq("parlamentar_id", parlamentar.id)
      .order("data_apresentacao", { ascending: false })
      .limit(3),
    supabase
      .from("despesa")
      .select("natureza, valor_liquido")
      .eq("parlamentar_id", parlamentar.id)
      .eq("ano", ANO),
    supabase
      .from("despesa_resumo_ano")
      .select("total")
      .eq("parlamentar_id", parlamentar.id)
      .eq("ano", ANO)
      .maybeSingle(),
    supabase
      .from("proposicao")
      .select("*", { count: "exact", head: true })
      .eq("parlamentar_id", parlamentar.id),
  ]);

  // Gastos por categoria (agrupados em JS)
  const catMap: Record<string, number> = {};
  for (const d of despesasCat ?? []) {
    const key = (d as { natureza?: string; valor_liquido?: number }).natureza ?? "Outros";
    catMap[key] = (catMap[key] ?? 0) + ((d as { valor_liquido?: number }).valor_liquido ?? 0);
  }
  const gastosOrdenados = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const gastosChart: GastoItem[] = gastosOrdenados.map(([label, total], i) => ({
    label,
    total,
    cor: CORES_GASTO[i] ?? "#1351B4",
  }));

  const totalGasto = (resumo as { total?: number } | null)?.total ?? 0;
  const aprovadas = (proposicoes ?? []).filter((p: Proposicao) => p.aprovada).length;

  const kpis = [
    {
      label: "Gasto em 2025",
      valor: totalGasto > 0 ? formatGastoKPI(totalGasto) : "—",
      delta: totalGasto > 0 ? "cota parlamentar" : "sem dados de despesa",
      deltaPos: false,
    },
    {
      label: "Presença",
      valor: "N/D",
      delta: "dados em breve",
      deltaPos: false,
    },
    {
      label: "Proposições",
      valor: (totalProps ?? 0).toLocaleString("pt-BR"),
      delta: aprovadas > 0 ? `${aprovadas} viraram lei` : "autor/coautor",
      deltaPos: aprovadas > 0,
    },
    {
      label: "Ranking de gastos",
      valor: "—",
      delta: "cálculo em breve",
      deltaPos: false,
    },
  ];

  const propsExibidas = (proposicoes ?? []).slice(0, 3).map((p: Proposicao) => ({
    titulo: `${p.tipo} ${p.numero}/${p.ano}${p.ementa ? ` — ${p.ementa.slice(0, 80)}${p.ementa.length > 80 ? "…" : ""}` : ""}`,
    status: mapStatus(p),
    data: formatData(p),
  }));

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-surface-alt border-b border-border-base">
        <div className="max-w-[1180px] mx-auto px-8 py-[14px] text-[13px] text-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-text-strong transition-colors">Início</Link>
          <span>›</span>
          <Link href={`/${casa}`} className="hover:text-text-strong transition-colors">{label}</Link>
          <span>›</span>
          <span className="text-text-strong font-semibold">{parlamentar.nome}</span>
        </div>
      </div>

      {/* Header do perfil */}
      <div className="max-w-[1180px] mx-auto px-8 pt-9">
        <div className="flex gap-7 items-start">
          <div className="w-[110px] h-[110px] rounded-2xl bg-blue-bg border border-border-input flex items-center justify-center text-brand-blue font-extrabold text-[34px] shrink-0 select-none">
            {iniciais(parlamentar.nome)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[30px] font-extrabold tracking-tight text-text-strong">
                {parlamentar.nome}
              </h1>
              {parlamentar.situacao && (
                <span className="rounded-full bg-blue-bg text-brand-blue text-xs font-bold px-3 py-[5px]">
                  {parlamentar.situacao}
                </span>
              )}
            </div>
            <p className="text-[15px] text-text-body mt-1.5">
              {cargo}
              {parlamentar.partido && <> · <strong>{parlamentar.partido}</strong></>}
              {parlamentar.uf && <> · {parlamentar.uf}</>}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 shrink-0">
            <button className="bg-brand-blue text-white px-5 py-[11px] rounded-lg font-bold text-sm hover:bg-[#0d3d96] transition-colors">
              Criar alerta
            </button>
            <button className="border border-border-input text-[#33404f] px-5 py-[11px] rounded-lg font-bold text-sm hover:bg-surface-alt transition-colors">
              Baixar dados
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-[1180px] mx-auto px-8 mt-6">
        <div className="flex border-b border-border-base">
          {TABS.map((tab) => (
            <span
              key={tab}
              className={`px-5 py-[14px] text-sm select-none ${
                tab === "Visão geral"
                  ? "text-brand-blue font-bold border-b-[3px] border-brand-blue -mb-px"
                  : "text-text-body font-semibold cursor-pointer hover:text-text-strong"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="border-b border-border-base">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 sm:grid-cols-4">
          {kpis.map(({ label: kpiLabel, valor, delta, deltaPos }, i) => (
            <div
              key={kpiLabel}
              className={`px-[26px] py-6 ${i < 3 ? "sm:border-r border-border-base" : ""}`}
            >
              <div className="text-[13px] text-text-body font-semibold mb-1.5">
                {kpiLabel}
              </div>
              <div className="text-[26px] font-extrabold text-brand-blue-dark">{valor}</div>
              <div
                className={`text-xs font-semibold mt-1 ${deltaPos ? "text-brand-green" : "text-text-body"}`}
              >
                {delta}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Corpo — 2 colunas */}
      <div className="max-w-[1180px] mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">
        {/* Gastos por categoria — Recharts */}
        <div>
          <h2 className="text-[18px] font-extrabold text-text-strong mb-4">
            Gastos por categoria
          </h2>
          {gastosChart.length > 0 ? (
            <>
              <GastosChart data={gastosChart} />
              <Link
                href={`/${casa}/${id}/despesas`}
                className="block mt-3.5 text-[13px] text-brand-blue font-bold hover:underline"
              >
                Ver todas as notas fiscais →
              </Link>
            </>
          ) : (
            <p className="text-sm text-text-muted py-6">
              Sem dados de despesa disponíveis para {ANO}.
            </p>
          )}
        </div>

        {/* Proposições recentes */}
        <div>
          <h2 className="text-[18px] font-extrabold text-text-strong mb-4">
            Proposições recentes
          </h2>
          {propsExibidas.length > 0 ? (
            <div className="flex flex-col gap-3">
              {propsExibidas.map(({ titulo, status, data }) => (
                <div key={titulo} className="border border-border-base rounded-[10px] p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[11px] font-bold px-[9px] py-1 rounded-[6px] ${STATUS_BADGE[status] ?? "bg-surface-alt text-text-body"}`}
                    >
                      {status}
                    </span>
                    {data && <span className="text-xs text-text-muted">{data}</span>}
                  </div>
                  <p className="font-bold text-sm text-text-strong leading-snug">{titulo}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted py-6">
              Nenhuma proposição encontrada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
