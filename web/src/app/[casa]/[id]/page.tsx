import { supabase } from "@/lib/db";
import PainelAtuacao from "@/components/PainelAtuacao";
import TabsDetalhe from "@/components/TabsDetalhe";
import type { DespesaResumoAno, Mandato, Parlamentar, Proposicao } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 3600;

const LABELS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
};

interface Props {
  params: Promise<{ casa: string; id: string }>;
  searchParams: Promise<{ aba?: string; filtro?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { casa, id } = await params;
  const { data } = await supabase
    .from("parlamentar")
    .select("nome")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single();
  return { title: data?.nome ?? "Parlamentar" };
}

export default async function DetalhePage({ params, searchParams }: Props) {
  const { casa, id } = await params;
  const { aba: initialAba, filtro: initialFiltro } = await searchParams;

  const { data: parlamentar } = await supabase
    .from("parlamentar")
    .select("*")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single<Parlamentar>();

  if (!parlamentar) notFound();

  const [{ data: mandatos }, { data: proposicoes }, { data: resumoAno }] = await Promise.all([
    supabase.from("mandato").select("*").eq("parlamentar_id", parlamentar.id).order("legislatura"),
    supabase
      .from("proposicao")
      .select("*")
      .eq("parlamentar_id", parlamentar.id)
      .order("ano", { ascending: false }),
    supabase
      .from("despesa_resumo_ano")
      .select("*")
      .eq("parlamentar_id", parlamentar.id)
      .order("ano", { ascending: false }),
  ]);

  // Totais para o PainelAtuacao derivados do resumo por ano (leve, sem carregar N mil linhas)
  const totalGasto = (resumoAno ?? []).reduce(
    (acc: number, r: DespesaResumoAno) => acc + (r.total ?? 0),
    0
  );
  const totalDespesas = (resumoAno ?? []).reduce(
    (acc: number, r: DespesaResumoAno) => acc + (r.lancamentos ?? 0),
    0
  );
  const aprovadas = (proposicoes ?? []).filter((p: Proposicao) => p.aprovada).length;
  const primeiroAutor = (proposicoes ?? []).filter((p: Proposicao) => p.autor_principal).length;
  const aprovadasPrimeiroAutor = (proposicoes ?? []).filter(
    (p: Proposicao) => p.aprovada && p.autor_principal
  ).length;

  const corCasa = casa === "camara" ? "bg-marinho-700" : "bg-green-700";

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Localização" className="text-sm text-slate-500 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-slate-700 transition-colors">Início</Link>
        <span>/</span>
        <Link href={`/${casa}`} className="hover:text-slate-700 transition-colors">{LABELS[casa]}</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">{parlamentar.nome}</span>
      </nav>

      {/* Cabeçalho do parlamentar */}
      <div className="card p-6 mb-6 flex gap-5 items-center">
        <div className="flex-shrink-0 relative">
          {parlamentar.foto_url ? (
            <Image
              src={parlamentar.foto_url}
              alt={parlamentar.nome}
              width={100}
              height={100}
              className="rounded-full object-cover ring-4 ring-slate-100"
            />
          ) : (
            <div className="w-[100px] h-[100px] rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500">
              {parlamentar.nome.charAt(0)}
            </div>
          )}
          <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${corCasa} ring-2 ring-white`} />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{parlamentar.nome}</h1>
          {parlamentar.nome_civil && parlamentar.nome_civil !== parlamentar.nome && (
            <p className="text-slate-500 text-sm mt-0.5">{parlamentar.nome_civil}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {parlamentar.partido && (
              <span className="badge badge-gray">{parlamentar.partido}</span>
            )}
            {parlamentar.uf && (
              <span className="badge badge-gray">{parlamentar.uf}</span>
            )}
            <span className={`badge ${casa === "camara" ? "bg-marinho-100 text-marinho-700" : "bg-green-100 text-green-700"}`}>
              {LABELS[casa]}
            </span>
          </div>
          {(mandatos ?? []).map((m: Mandato) => (
            <p key={m.id} className="text-xs text-slate-500 mt-2">
              {m.legislatura}ª Legislatura
              {m.data_inicio
                ? ` · desde ${new Date(m.data_inicio).toLocaleDateString("pt-BR")}`
                : ""}
            </p>
          ))}
        </div>
      </div>

      {/* Painel de stats */}
      <PainelAtuacao
        casa={parlamentar.casa}
        parlamentarId={parlamentar.id_externo}
        totalProposicoes={(proposicoes ?? []).length}
        primeiroAutor={primeiroAutor}
        aprovadas={aprovadas}
        aprovadasPrimeiroAutor={aprovadasPrimeiroAutor}
        totalGasto={totalGasto}
        totalDespesas={totalDespesas}
      />

      {/* Tabs — projetos e despesas */}
      <div className="mt-6">
        <TabsDetalhe
          proposicoes={(proposicoes ?? []) as Proposicao[]}
          resumoAno={(resumoAno ?? []) as DespesaResumoAno[]}
          casa={parlamentar.casa}
          parlamentarId={parlamentar.id_externo}
          parlamentarDbId={parlamentar.id}
          initialAba={initialAba}
          initialFiltro={initialFiltro}
        />
      </div>
    </main>
  );
}
