import { supabase } from "@/lib/db";
import Link from "next/link";

export const revalidate = 3600;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function fetchStats() {
  const [
    { count: totalCamara },
    { count: totalSenado },
    { count: totalProps },
    { data: gastoData },
  ] = await Promise.all([
    supabase.from("parlamentar").select("*", { count: "exact", head: true }).eq("casa", "camara").eq("situacao", "Exercício"),
    supabase.from("parlamentar").select("*", { count: "exact", head: true }).eq("casa", "senado").eq("situacao", "Exercício"),
    supabase.from("proposicao").select("*", { count: "exact", head: true }),
    supabase.from("despesa_totais").select("total_geral").single(),
  ]);
  const totalGasto = (gastoData as { total_geral: number } | null)?.total_geral ?? 0;
  return { totalCamara, totalSenado, totalProps, totalGasto };
}

export default async function Home() {
  const { totalCamara, totalSenado, totalProps, totalGasto } = await fetchStats();

  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-14">
        <h1 className="text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          Portal Parlamentar
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          Acompanhe a atuação de todos os senadores e deputados federais em exercício.
          Dados oficiais, sem login e sem rastreamento.
        </p>
      </div>

      {/* Cards de navegação */}
      <div className="grid sm:grid-cols-2 gap-6 mb-14">
        <Link
          href="/camara"
          className="card p-8 hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
            <span className="text-blue-700 font-bold text-lg">C</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">
            Câmara dos Deputados
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            {totalCamara ?? "—"} deputados federais em exercício
          </p>
          <span className="text-blue-600 text-sm font-medium group-hover:underline">
            Ver deputados →
          </span>
        </Link>

        <Link
          href="/senado"
          className="card p-8 hover:shadow-md hover:border-emerald-200 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
            <span className="text-emerald-700 font-bold text-lg">S</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-emerald-700 transition-colors">
            Senado Federal
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            {totalSenado ?? "—"} senadores em exercício
          </p>
          <span className="text-emerald-600 text-sm font-medium group-hover:underline">
            Ver senadores →
          </span>
        </Link>
      </div>

      {/* Números em destaque */}
      <div className="grid grid-cols-3 gap-4">
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
