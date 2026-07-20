import { supabase } from "@/lib/db";
import Link from "next/link";

export const revalidate = 3600;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function fetchStats() {
  const [
    { count: totalCamara },
    { count: totalSenado },
    { count: totalProps },
    { data: gastoView, error: gastoErr },
  ] = await Promise.all([
    supabase.from("parlamentar").select("*", { count: "exact", head: true }).eq("casa", "camara").eq("situacao", "Exercício"),
    supabase.from("parlamentar").select("*", { count: "exact", head: true }).eq("casa", "senado").eq("situacao", "Exercício"),
    supabase.from("proposicao").select("*", { count: "exact", head: true }),
    supabase.from("despesa_totais").select("total_geral").single(),
  ]);

  let totalGasto = (gastoView as { total_geral: number } | null)?.total_geral ?? 0;

  // Fallback: view não existe no banco — soma direto da tabela
  if (gastoErr) {
    const { data: rows } = await supabase.from("despesa").select("valor_liquido");
    totalGasto = (rows ?? []).reduce(
      (s: number, r: { valor_liquido: number | null }) => s + (r.valor_liquido ?? 0),
      0
    );
  }

  return { totalCamara, totalSenado, totalProps, totalGasto };
}

export default async function Home() {
  const { totalCamara, totalSenado, totalProps, totalGasto } = await fetchStats();

  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          Portal Parlamentar
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          Acompanhe a atuação de todos os senadores e deputados federais em exercício.
          Dados oficiais, sem login e sem rastreamento.
        </p>
      </div>

      {/* Cards de navegação */}
      <div className="grid sm:grid-cols-2 gap-6 mb-10">
        <Link
          href="/camara"
          className="card p-8 hover:shadow-md hover:border-marinho-200 transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-marinho-100 flex items-center justify-center mb-4">
            <span className="text-marinho-700 font-bold text-lg">C</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-marinho-700 transition-colors">
            Câmara dos Deputados
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            {totalCamara ?? "—"} deputados federais em exercício
          </p>
          <span className="text-marinho-700 text-sm font-medium group-hover:underline">
            Ver deputados →
          </span>
        </Link>

        <Link
          href="/senado"
          className="card p-8 hover:shadow-md hover:border-green-200 transition group"
        >
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-4">
            <span className="text-green-700 font-bold text-lg">S</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-green-700 transition-colors">
            Senado Federal
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            {totalSenado ?? "—"} senadores em exercício
          </p>
          <span className="text-green-700 text-sm font-medium group-hover:underline">
            Ver senadores →
          </span>
        </Link>
      </div>

      {/* Números em destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-slate-900">
            {((totalCamara ?? 0) + (totalSenado ?? 0)).toLocaleString("pt-BR")}
          </p>
          <p className="text-sm text-slate-500 mt-1">parlamentares</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-slate-900">
            {(totalProps ?? 0).toLocaleString("pt-BR")}
          </p>
          <p className="text-sm text-slate-500 mt-1">proposições registradas</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-slate-900">
            {BRL.format(totalGasto)}
          </p>
          <p className="text-sm text-slate-500 mt-1">em cotas parlamentares</p>
        </div>
      </div>
    </main>
  );
}
