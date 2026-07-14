"use client";

import type { Casa, Despesa } from "@/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  despesas: Despesa[];
  casa: Casa;
  parlamentarId: number;
}

export default function TabelaCotas({ despesas, casa, parlamentarId }: Props) {
  const anos = useMemo(
    () => [...new Set(despesas.map((d) => d.ano))].sort((a, b) => b - a),
    [despesas]
  );
  const [ano, setAno] = useState<number>(anos[0] ?? new Date().getFullYear());

  const doAno = useMemo(
    () => despesas.filter((d) => d.ano === ano),
    [despesas, ano]
  );

  const totalAno = doAno.reduce((s, d) => s + (d.valor_liquido ?? 0), 0);

  // Agrupa por mês
  const porMes = useMemo(() => {
    const map = new Map<number, { total: number; itens: Despesa[] }>();
    for (const d of doAno) {
      const entry = map.get(d.mes) ?? { total: 0, itens: [] };
      entry.total += d.valor_liquido ?? 0;
      entry.itens.push(d);
      map.set(d.mes, entry);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [doAno]);

  // Top naturezas
  const porNatureza = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of doAno) {
      const nat = d.natureza ?? "Outros";
      map.set(nat, (map.get(nat) ?? 0) + (d.valor_liquido ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [doAno]);

  return (
    <div>
      {/* Seletor de ano + total */}
      <div className="flex flex-wrap gap-3 items-center mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {anos.map((a) => (
            <button
              key={a}
              onClick={() => setAno(a)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                ano === a
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-600 ml-auto font-medium">
          Total: <span className="font-bold text-slate-900">{BRL.format(totalAno)}</span>
        </span>
      </div>

      {/* Top naturezas */}
      {porNatureza.length > 0 && (
        <div className="card p-4 mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Por categoria
          </p>
          <div className="space-y-2">
            {porNatureza.map(([nat, val]) => (
              <div key={nat} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 flex-1 truncate">{nat}</span>
                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (val / totalAno) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-slate-700 flex-shrink-0 w-28 text-right">
                  {BRL.format(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista por mês */}
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {porMes.map(([mes, { total, itens }]) => (
          <details key={mes} className="group">
            <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 list-none select-none">
              <span className="text-sm font-semibold text-slate-700 w-12">
                {MESES[mes]}
              </span>
              <span className="text-xs text-slate-400">{itens.length} lançamentos</span>
              <span className="ml-auto text-sm font-mono font-medium text-slate-800">
                {BRL.format(total)}
              </span>
              <span className="text-slate-300 group-open:rotate-90 transition-transform text-xs">▶</span>
            </summary>
            <div className="bg-slate-50 divide-y divide-slate-100">
              {itens.map((d) => (
                <Link
                  key={d.id}
                  href={`/${casa}/${parlamentarId}/despesas/${d.id}`}
                  className="flex items-center gap-3 px-6 py-2.5 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-xs text-slate-600 flex-1 truncate">{d.natureza}</span>
                  <span className="text-xs text-slate-400 truncate max-w-[180px] hidden sm:block">
                    {d.fornecedor}
                  </span>
                  <span className="text-xs font-mono text-slate-700 flex-shrink-0">
                    {BRL.format(d.valor_liquido ?? 0)}
                  </span>
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
