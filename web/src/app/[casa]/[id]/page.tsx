import { supabase } from "@/lib/db";
import ListaProposicoes from "@/components/ListaProposicoes";
import PainelAtuacao from "@/components/PainelAtuacao";
import TabelaCotas from "@/components/TabelaCotas";
import type { Despesa, Mandato, Parlamentar, Proposicao } from "@/types";
import Image from "next/image";
import { notFound } from "next/navigation";

export const revalidate = 3600;

interface Props {
  params: Promise<{ casa: string; id: string }>;
}

export default async function DetalhePage({ params }: Props) {
  const { casa, id } = await params;

  const { data: parlamentar } = await supabase
    .from("parlamentar")
    .select("*")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single<Parlamentar>();

  if (!parlamentar) notFound();

  const [{ data: mandatos }, { data: proposicoes }, { data: despesas }] = await Promise.all([
    supabase.from("mandato").select("*").eq("parlamentar_id", parlamentar.id).order("legislatura"),
    supabase
      .from("proposicao")
      .select("*")
      .eq("parlamentar_id", parlamentar.id)
      .order("ano", { ascending: false }),
    supabase
      .from("despesa")
      .select("*")
      .eq("parlamentar_id", parlamentar.id)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false }),
  ]);

  const totalGasto = (despesas ?? []).reduce(
    (acc: number, d: Despesa) => acc + (d.valor_liquido ?? 0),
    0
  );

  return (
    <main className="p-8 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex gap-6 items-start mb-8">
        {parlamentar.foto_url ? (
          <Image
            src={parlamentar.foto_url}
            alt={parlamentar.nome}
            width={120}
            height={120}
            className="rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-[120px] h-[120px] rounded-full bg-gray-200 flex-shrink-0" />
        )}
        <div>
          <h1 className="text-3xl font-bold">{parlamentar.nome}</h1>
          {parlamentar.nome_civil && parlamentar.nome_civil !== parlamentar.nome && (
            <p className="text-gray-500 text-sm mt-1">{parlamentar.nome_civil}</p>
          )}
          <p className="text-gray-600 mt-2">
            {parlamentar.partido} · {parlamentar.uf} ·{" "}
            <span className="capitalize">{parlamentar.casa === "camara" ? "Câmara" : "Senado"}</span>
          </p>
          {(mandatos ?? []).map((m: Mandato) => (
            <p key={m.id} className="text-xs text-gray-400 mt-1">
              {m.legislatura}ª Legislatura
              {m.data_inicio ? ` — desde ${new Date(m.data_inicio).toLocaleDateString("pt-BR")}` : ""}
            </p>
          ))}
        </div>
      </div>

      <PainelAtuacao
        totalProposicoes={(proposicoes ?? []).length}
        aprovadas={(proposicoes ?? []).filter((p: Proposicao) => p.aprovada).length}
        totalGasto={totalGasto}
      />

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Projetos de lei</h2>
        {proposicoes?.length ? (
          <ListaProposicoes proposicoes={proposicoes} casa={parlamentar.casa} parlamentarId={parlamentar.id_externo} />
        ) : (
          <p className="text-gray-400 text-sm">Nenhuma proposição encontrada.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Cota parlamentar (CEAP)</h2>
        {despesas?.length ? (
          <TabelaCotas despesas={despesas} casa={parlamentar.casa} parlamentarId={parlamentar.id_externo} />
        ) : (
          <p className="text-gray-400 text-sm">Nenhuma despesa encontrada.</p>
        )}
      </section>
    </main>
  );
}
