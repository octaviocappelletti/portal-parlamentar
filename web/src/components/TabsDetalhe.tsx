"use client";

import type { Casa, DespesaResumoAno, Proposicao } from "@/types";
import { useState } from "react";
import ListaProposicoes from "./ListaProposicoes";
import TabelaCotas from "./TabelaCotas";

interface Props {
  proposicoes: Proposicao[];
  resumoAno: DespesaResumoAno[];
  casa: Casa;
  parlamentarId: number;    // id_externo — usado nas URLs
  parlamentarDbId: number;  // id interno  — usado nas queries do banco
  initialAba?: string;
  initialFiltro?: string;
}

const TABS = ["Projetos de lei", "Cota parlamentar (CEAP)"] as const;

export default function TabsDetalhe({
  proposicoes,
  resumoAno,
  casa,
  parlamentarId,
  parlamentarDbId,
  initialAba,
  initialFiltro,
}: Props) {
  const [aba, setAba] = useState<(typeof TABS)[number]>(
    initialAba === "despesas" ? TABS[1] : TABS[0]
  );

  const totalLancamentos = resumoAno.reduce((s, r) => s + (r.lancamentos ?? 0), 0);

  return (
    <div>
      <div role="tablist" className="flex border-b border-slate-200 mb-6 gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={aba === t}
            onClick={() => setAba(t)}
            className={`tab ${aba === t ? "tab-active" : "tab-inactive"}`}
          >
            {t}
            <span className="ml-1.5 text-xs text-slate-500">
              {t === "Projetos de lei"
                ? proposicoes.length
                : totalLancamentos.toLocaleString("pt-BR")}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={aba}>
        {aba === "Projetos de lei" ? (
          proposicoes.length ? (
            <ListaProposicoes
              proposicoes={proposicoes}
              casa={casa}
              parlamentarId={parlamentarId}
              initialFiltro={initialFiltro}
            />
          ) : (
            <Vazio>Nenhuma proposição encontrada.</Vazio>
          )
        ) : resumoAno.length ? (
          <TabelaCotas
            resumoAno={resumoAno}
            casa={casa}
            parlamentarId={parlamentarId}
            parlamentarDbId={parlamentarDbId}
          />
        ) : (
          <Vazio>Nenhuma despesa encontrada. Execute a ingestão de despesas primeiro.</Vazio>
        )}
      </div>
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-16 text-slate-500 text-sm">{children}</div>
  );
}
