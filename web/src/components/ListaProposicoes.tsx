"use client";

import type { Casa, Proposicao } from "@/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const SITUACOES = ["Todas", "Aprovadas", "Em tramitação", "Arquivadas"] as const;
type Filtro = (typeof SITUACOES)[number];

const LABEL_SITUACAO: Record<string, string> = {
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
  const [filtro, setFiltro] = useState<Filtro>("Todas");
  const [busca, setBusca] = useState("");
  const [soAutor, setSoAutor] = useState(false);

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return proposicoes.filter((p) => {
      if (filtro === "Aprovadas" && !p.aprovada) return false;
      if (filtro === "Em tramitação" && p.situacao !== "em tramitacao") return false;
      if (filtro === "Arquivadas" && p.situacao !== "arquivada") return false;
      if (soAutor && !p.autor_principal) return false;
      if (termo && !(p.ementa ?? "").toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [proposicoes, filtro, busca, soAutor]);

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {SITUACOES.map((s) => (
            <button
              key={s}
              onClick={() => setFiltro(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filtro === s
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={soAutor}
            onChange={(e) => setSoAutor(e.target.checked)}
            className="rounded border-slate-300"
          />
          Só autor principal
        </label>
        <input
          type="search"
          placeholder="Buscar na ementa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input flex-1 min-w-[180px]"
        />
        <span className="text-xs text-slate-400">{filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Nenhuma proposição encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {filtradas.map((p) => (
            <Link
              key={p.id}
              href={`/${casa}/${parlamentarId}/projetos/${p.id}`}
              className="flex items-start gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <span className="font-mono text-xs text-slate-400 flex-shrink-0 pt-0.5 w-[120px]">
                {p.tipo} {p.numero}/{p.ano}
              </span>
              <p className="flex-1 text-sm text-slate-700 line-clamp-2 leading-snug">
                {p.ementa ?? "Sem ementa disponível"}
              </p>
              <div className="flex-shrink-0 flex flex-col items-end gap-1 ml-2">
                {p.situacao && (
                  <span className={`badge ${
                    p.aprovada
                      ? "badge-green"
                      : p.situacao === "arquivada"
                      ? "badge-gray"
                      : "badge-yellow"
                  }`}>
                    {LABEL_SITUACAO[p.situacao] ?? p.situacao}
                  </span>
                )}
                {p.autor_principal === false && (
                  <span className="badge badge-purple">Coautor</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
