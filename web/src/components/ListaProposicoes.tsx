import type { Proposicao, Casa } from "@/types";
import Link from "next/link";

const SITUACAO_LABEL: Record<string, string> = {
  aprovada: "Aprovada",
  arquivada: "Arquivada",
  "em tramitacao": "Em tramitação",
};

interface Props {
  proposicoes: Proposicao[];
  casa: Casa;
  parlamentarId: number;
}

export default function ListaProposicoes({ proposicoes, casa, parlamentarId }: Props) {
  return (
    <div className="divide-y border rounded-lg overflow-hidden">
      {proposicoes.map((p) => (
        <Link
          key={p.id}
          href={`/${casa}/${parlamentarId}/projetos/${p.id}`}
          className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <span className="font-mono text-sm text-gray-500 flex-shrink-0 pt-0.5">
            {p.tipo} {p.numero}/{p.ano}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2">{p.ementa ?? "Sem ementa"}</p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {p.situacao && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  p.aprovada
                    ? "bg-green-100 text-green-700"
                    : p.situacao === "arquivada"
                    ? "bg-gray-100 text-gray-400"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {SITUACAO_LABEL[p.situacao] ?? p.situacao}
              </span>
            )}
            {p.autor_principal === false && (
              <span className="text-xs text-purple-500">Coautor</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
