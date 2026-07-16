import { supabase } from "@/lib/db";
import type { Proposicao } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 86400;

interface Props {
  params: Promise<{ casa: string; id: string; proposicaoId: string }>;
}

const SITUACAO_LABEL: Record<string, string> = {
  aprovada: "Aprovada",
  arquivada: "Arquivada",
  "em tramitacao": "Em tramitação",
};

export default async function ProposicaoPage({ params }: Props) {
  const { casa, id, proposicaoId } = await params;

  const { data: proposicao } = await supabase
    .from("proposicao")
    .select("*")
    .eq("id", Number(proposicaoId))
    .single<Proposicao>();

  if (!proposicao) notFound();

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <Link href={`/${casa}/${id}`} className="text-sm text-blue-600 hover:underline mb-6 block">
        &larr; Voltar ao parlamentar
      </Link>

      <div className="flex gap-3 items-center mb-4">
        <span className="font-mono text-lg font-bold">
          {proposicao.tipo} {proposicao.numero}/{proposicao.ano}
        </span>
        {proposicao.situacao && (
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              proposicao.aprovada
                ? "bg-green-100 text-green-700"
                : proposicao.situacao === "arquivada"
                ? "bg-gray-100 text-gray-500"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {SITUACAO_LABEL[proposicao.situacao] ?? proposicao.situacao}
          </span>
        )}
        {proposicao.autor_principal === false && (
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
            Não é 1º autor
          </span>
        )}
      </div>

      {proposicao.ementa && (
        <p className="text-gray-700 mb-6 leading-relaxed">{proposicao.ementa}</p>
      )}

      {proposicao.data_apresentacao && (
        <p className="text-sm text-gray-400 mb-4">
          Apresentada em{" "}
          {new Date(proposicao.data_apresentacao).toLocaleDateString("pt-BR")}
        </p>
      )}

      {proposicao.url_inteiro_teor ? (
        <a
          href={proposicao.url_inteiro_teor}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Ver íntegra (fonte oficial)
        </a>
      ) : (
        <p className="text-sm text-gray-400">Íntegra não disponível.</p>
      )}
    </main>
  );
}
