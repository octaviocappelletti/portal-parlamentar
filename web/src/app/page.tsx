import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import GastosChart from "@/components/GastosChart";
import { supabase } from "@/lib/db";
import { MOCK_GASTOS_HOME } from "@/lib/mock";

export const revalidate = 3600;

const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const NUM_COMPACT = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

async function fetchStats() {
  const [
    { count: totalCamara },
    { count: totalSenado },
    { count: totalProps },
    { data: gastoView, error: gastoErr },
  ] = await Promise.all([
    supabase
      .from("parlamentar")
      .select("*", { count: "exact", head: true })
      .eq("casa", "camara")
      .eq("situacao", "Exercício"),
    supabase
      .from("parlamentar")
      .select("*", { count: "exact", head: true })
      .eq("casa", "senado"),
    supabase.from("proposicao").select("*", { count: "exact", head: true }),
    supabase.from("despesa_totais").select("total_geral").single(),
  ]);

  let totalGasto: number =
    (gastoView as { total_geral: number } | null)?.total_geral ?? 0;

  if (gastoErr) {
    const { data: rows } = await supabase.from("despesa").select("valor_liquido");
    totalGasto = (rows ?? []).reduce(
      (s: number, r: { valor_liquido: number | null }) => s + (r.valor_liquido ?? 0),
      0,
    );
  }

  return { totalCamara, totalSenado, totalProps, totalGasto };
}

const COMO_FUNCIONA = [
  {
    num: "1",
    titulo: "Encontre o parlamentar",
    texto: "Busque por nome, estado ou partido e acesse o perfil completo.",
    badge: "bg-blue-bg text-brand-blue",
    href: null,
  },
  {
    num: "2",
    titulo: "Analise os gastos",
    texto: "Gráficos claros mostram para onde vai cada real da verba.",
    badge: "bg-green-bg text-brand-green",
    href: "/gastos",
  },
  {
    num: "3",
    titulo: "Acompanhe as leis",
    texto: "Veja projetos de lei, votos e a tramitação de cada proposta.",
    badge: "bg-yellow-bg text-yellow-text",
    href: "/proposicoes",
  },
] as const;

export default async function Home() {
  const { totalCamara, totalSenado, totalProps, totalGasto } = await fetchStats();

  const stats = [
    {
      valor: (totalCamara ?? 513).toLocaleString("pt-BR"),
      cor: "text-brand-blue",
      label: "Deputados federais",
      href: "/camara",
    },
    {
      valor: (totalSenado ?? 81).toLocaleString("pt-BR"),
      cor: "text-brand-green",
      label: "Senadores",
      href: "/senado",
    },
    {
      valor: totalGasto > 0 ? BRL_COMPACT.format(totalGasto) : "R$ 1,2 bi",
      cor: "text-brand-blue-dark",
      label: "Em verbas",
      href: "/gastos",
    },
    {
      valor:
        (totalProps ?? 0) > 0
          ? NUM_COMPACT.format(totalProps ?? 0)
          : "28,4 mil",
      cor: "text-brand-blue-dark",
      label: "Proposições",
      href: "/proposicoes",
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-surface-alt to-white px-4 sm:px-8 pt-10 sm:pt-14 pb-10 sm:pb-12 text-center">
        <div className="max-w-[1180px] mx-auto">
          <span className="inline-block rounded-full bg-blue-bg text-brand-blue text-xs font-bold px-3.5 py-[6px] uppercase tracking-[0.04em] mb-5">
            Dados oficiais · Câmara e Senado
          </span>
          <h1 className="text-[42px] font-extrabold leading-[1.1] tracking-[-0.02em] max-w-[760px] mx-auto mb-4 text-text-strong">
            Descubra o que seu parlamentar anda fazendo
          </h1>
          <p className="text-lg text-text-body max-w-[600px] mx-auto mb-8 leading-relaxed">
            Custos, proposições e verbas de deputados e senadores, explicados de
            forma simples.
          </p>
          <SearchBar />
          <p className="mt-[18px] text-[13px] text-text-muted">
            Populares:{" "}
            <Link
              href="/camara"
              className="text-brand-blue font-semibold hover:underline"
            >
              Câmara dos Deputados
            </Link>
            {" · "}
            <Link
              href="/senado"
              className="text-brand-blue font-semibold hover:underline"
            >
              Senado Federal
            </Link>
            {" · "}
            <Link
              href="/proposicoes?status=tramitacao"
              className="text-brand-blue font-semibold hover:underline"
            >
              PLs em tramitação
            </Link>
          </p>
        </div>
      </section>

      {/* Stats strip — valores reais do banco */}
      <div className="border-t border-border-base">
        <div className="max-w-[1180px] mx-auto grid grid-cols-2 sm:grid-cols-4">
          {stats.map(({ valor, cor, label, href }, i) => (
            <Link
              key={label}
              href={href}
              className={`text-center py-[26px] px-6 hover:bg-surface-alt transition-colors ${i < 3 ? "sm:border-r border-border-base" : ""}`}
            >
              <div className={`text-[30px] font-extrabold ${cor}`}>{valor}</div>
              <div className="text-[13px] text-text-body font-semibold mt-1">
                {label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Como funciona */}
      <section className="bg-surface-alt px-4 sm:px-8 py-11">
        <div className="max-w-[1180px] mx-auto">
          <h2 className="text-[22px] font-extrabold text-center mb-1.5 text-text-strong">
            Como funciona
          </h2>
          <p className="text-center text-text-body text-[15px] mb-7">
            Três passos para acompanhar a atividade parlamentar
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {COMO_FUNCIONA.map(({ num, titulo, texto, badge, href }) => {
              const inner = (
                <>
                  <div className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center font-extrabold mb-3.5 ${badge}`}>
                    {num}
                  </div>
                  <h3 className="font-bold text-base text-text-strong mb-1.5">{titulo}</h3>
                  <p className="text-sm text-text-body leading-relaxed">{texto}</p>
                </>
              );
              return href ? (
                <Link
                  key={num}
                  href={href}
                  className="bg-white border border-border-base rounded-xl p-[26px] hover:shadow-md hover:-translate-y-px transition-all block"
                >
                  {inner}
                </Link>
              ) : (
                <div key={num} className="bg-white border border-border-base rounded-xl p-[26px]">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bloco de gastos — Recharts */}
      <section className="px-4 sm:px-8 py-11">
        <div className="max-w-[1180px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <p className="section-label mb-2">Cota parlamentar</p>
            <h2 className="text-[26px] font-extrabold leading-[1.2] text-text-strong mb-3">
              Para onde vai o dinheiro público
            </h2>
            <p className="text-[15px] text-text-body leading-relaxed mb-5">
              Cada categoria de gasto é detalhada com valores mensais, comparação
              com a média e histórico. Sem jargão — feito para qualquer cidadão
              entender.
            </p>
            <Link
              href="/gastos"
              className="inline-flex items-center gap-1 text-brand-blue font-bold text-[15px] hover:underline"
            >
              Ver ranking completo →
            </Link>
          </div>

          <div className="bg-white border border-border-base rounded-2xl p-6">
            <p className="text-[13px] text-text-body font-semibold mb-4">
              Gastos por categoria (média mensal)
            </p>
            <GastosChart data={MOCK_GASTOS_HOME as unknown as { label: string; total: number; cor: string }[]} />
          </div>
        </div>
      </section>
    </>
  );
}
