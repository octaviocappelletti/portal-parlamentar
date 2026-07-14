"use client";

import type { Casa, Despesa, Proposicao } from "@/types";
import { useState } from "react";
import ListaProposicoes from "./ListaProposicoes";
import TabelaCotas from "./TabelaCotas";

interface Props {
  proposicoes: Proposicao[];
  despesas: Despesa[];
  casa: Casa;
  parlamentarId: number;
}

const TABS = ["Projetos de lei", "Cota parlamentar (CEAP)"] as const;

export default function TabsDetalhe({ proposicoes, despesas, casa, parlamentarId }: Props) {
  const [aba, setAba] = useState<(typeof TABS)[number]>(TABS[0]);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6 gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className={`tab ${aba === t ? "tab-active" : "tab-inactive"}`}
          >
            {t}
            <span className="ml-1.5 text-xs text-slate-400">
              {t === "Projetos de lei" ? proposicoes.length : despesas.length}
            </span>
          </button>
        ))}
      </div>

      {aba === "Projetos de lei" ? (
        proposicoes.length ? (
          <ListaProposicoes
            proposicoes={proposicoes}
            casa={casa}
            parlamentarId={parlamentarId}
          />
        ) : (
          <Vazio>Nenhuma proposição encontrada.</Vazio>
        )
      ) : despesas.length ? (
        <TabelaCotas
          despesas={despesas}
          casa={casa}
          parlamentarId={parlamentarId}
        />
      ) : (
        <Vazio>Nenhuma despesa encontrada.</Vazio>
      )}
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-16 text-slate-400 text-sm">{children}</div>
  );
}
