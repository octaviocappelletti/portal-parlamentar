import { supabase } from "@/lib/db";
import type { Proposicao } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 86400;

interface Props {
  params: Promise<{ casa: string; id: string; proposicaoId: string }>;
}

const LABELS_CASA: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
};

const SITUACAO_LABEL: Record<string, string> = {
  aprovada: "Aprovada",
  arquivada: "Arquivada",
  "em tramitacao": "Em tramitação",
};

export default async function ProposicaoPage({ params }: Props) {
  const { casa, id, proposicaoId } = await params;

  const [{ data: parlamentar }, { data: proposicao }] = await Promise.all([
    supabase
      .from("parlamentar")
      .select("nome")
      .eq("casa", casa)
      .eq("id_externo", Number(id))
      .single(),
    supabase
      .from("proposicao")
      .select("*")
      .eq("id", Number(proposicaoId))
      .single<Proposicao>(),
  ]);

  if (!proposicao) notFound();

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <nav aria-label="Localização" className="text-sm text-slate-500 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-slate-700 transition-colors">Início</Link>
        <span>/</span>
        <Link href={`/${casa}`} className="hover:text-slate-700 transition-colors">{LABELS_CASA[casa] ?? casa}</Link>
        <span>/</span>
        <Link href={`/${casa}/${id}`} className="hover:text-slate-700 transition-colors">
          {parlamentar?.nome ?? "Parlamentar"}
        </Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">
          {proposicao.tipo} {proposicao.numero}/{proposicao.ano}
        </span>
      </nav>

      <div className="card p-6 mb-5">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="font-mono text-lg font-bold text-slate-900">
            {proposicao.tipo} {proposicao.numero}/{proposicao.ano}
          </span>
          {proposicao.situacao && (
            <span
              className={`badge ${
                proposicao.aprovada
                  ? "badge-green"
                  : proposicao.situacao === "arquivada"
                  ? "badge-gray"
                  : "badge-yellow"
              }`}
            >
              {SITUACAO_LABEL[proposicao.situacao] ?? proposicao.situacao}
            </span>
          )}
          {proposicao.autor_principal === false && (
            <span className="badge badge-gray">Não é 1º autor</span>
          )}
        </div>

        {proposicao.ementa && (
          <p className="text-slate-700 leading-relaxed">{proposicao.ementa}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        {proposicao.data_apresentacao && (
          <p className="text-sm text-slate-500">
            Apresentada em{" "}
            <span className="text-slate-700 font-medium">
              {new Date(proposicao.data_apresentacao).toLocaleDateString("pt-BR")}
            </span>
          </p>
        )}

        {proposicao.url_inteiro_teor ? (
          <a
            href={proposicao.url_inteiro_teor}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-marinho-700 text-white rounded-lg hover:bg-marinho-800 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marinho-600 focus-visible:ring-offset-2"
          >
            Ver íntegra (fonte oficial) ↗
          </a>
        ) : (
          <p className="text-sm text-slate-500">Íntegra não disponível.</p>
        )}
      </div>
    </main>
  );
}
