"use client";

import type { Casa, Proposicao } from "@/types";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Marinho family — azul da bandeira do Brasil
const CHART_ACTIVE = "#002776";
const CHART_DEFAULT = "#3b6fc4";
const CHART_MUTED = "#c4d2e7";

type StatusFiltro = "Todas" | "Aprovadas" | "Em tramitação" | "Arquivadas";
const STATUS_FILTROS: StatusFiltro[] = ["Todas", "Aprovadas", "Em tramitação", "Arquivadas"];

const LABEL_SITUACAO: Record<string, string> = {
  aprovada: "Aprovada",
  arquivada: "Arquivada",
  "em tramitacao": "Em tramitação",
};

interface Props {
  proposicoes: Proposicao[];
  casa: Casa;
  parlamentarId: number;
  initialFiltro?: string;
}

function parseInitialFiltro(f?: string): { status: StatusFiltro; soAutor: boolean } {
  switch (f) {
    case "primeiro-autor":           return { status: "Todas",    soAutor: true  };
    case "aprovadas":                return { status: "Aprovadas", soAutor: false };
    case "aprovadas-primeiro-autor": return { status: "Aprovadas", soAutor: true  };
    default:                         return { status: "Todas",    soAutor: false };
  }
}

export default function ListaProposicoes({ proposicoes, casa, parlamentarId, initialFiltro }: Props) {
  const init = parseInitialFiltro(initialFiltro);
  const [status, setStatus] = useState<StatusFiltro>(init.status);
  const [soAutor, setSoAutor] = useState(init.soAutor);
  const [busca, setBusca] = useState("");
  const [anoFiltro, setAnoFiltro] = useState<number | null>(null);

  // Dados para o gráfico: total de proposições por ano
  const dadosPorAno = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of proposicoes) {
      if (p.ano) map.set(p.ano, (map.get(p.ano) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, total]) => ({ ano, total }));
  }, [proposicoes]);

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return proposicoes.filter((p) => {
      if (anoFiltro && p.ano !== anoFiltro)                                    return false;
      if (status === "Aprovadas"     && !p.aprovada)                           return false;
      if (status === "Em tramitação" && p.situacao !== "em tramitacao")        return false;
      if (status === "Arquivadas"    && p.situacao !== "arquivada")            return false;
      if (soAutor && !p.autor_principal)                                       return false;
      if (termo && !(p.ementa ?? "").toLowerCase().includes(termo))            return false;
      return true;
    });
  }, [proposicoes, status, soAutor, busca, anoFiltro]);

  const handleBarClick = (data: unknown) => {
    const ano = (data as { ano: number }).ano;
    setAnoFiltro((prev) => (prev === ano ? null : ano));
  };

  return (
    <div>
      {/* Gráfico de colunas por ano */}
      {dadosPorAno.length >= 2 && (
        <div className="card p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label" id="chart-proposicoes-label">
              Proposições por ano
            </p>
            {anoFiltro && (
              <button
                onClick={() => setAnoFiltro(null)}
                className="text-xs text-marinho-700 hover:underline transition-colors flex items-center gap-1"
              >
                Mostrando {anoFiltro} · limpar filtro ×
              </button>
            )}
          </div>
          <div role="img" aria-labelledby="chart-proposicoes-label">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={dadosPorAno} barCategoryGap="35%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="ano"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
                formatter={(value) => [value, "proposições"]}
                labelFormatter={(label) => `Ano ${label}`}
              />
              <Bar
                dataKey="total"
                radius={[3, 3, 0, 0]}
                onClick={handleBarClick}
                style={{ cursor: "pointer" }}
              >
                {dadosPorAno.map((entry) => (
                  <Cell
                    key={entry.ano}
                    fill={
                      anoFiltro === null
                        ? CHART_DEFAULT
                        : anoFiltro === entry.ano
                        ? CHART_ACTIVE
                        : CHART_MUTED
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Filtro de status */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {STATUS_FILTROS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                status === s
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Toggle 1º autor — indisponível no Senado (todos os coautores são "Iniciadora") */}
        {casa !== "senado" && (
          <button
            onClick={() => setSoAutor((v) => !v)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              soAutor
                ? "bg-marinho-700 text-white border-marinho-700"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            Somente 1º autor
          </button>
        )}

        <label htmlFor="busca-proposicoes" className="sr-only">Buscar na ementa</label>
        <input
          id="busca-proposicoes"
          type="search"
          placeholder="Buscar na ementa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input flex-1 min-w-[180px]"
        />
        <span className="text-xs text-slate-500">
          {filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
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
              <span className="font-mono text-xs text-slate-500 flex-shrink-0 pt-0.5 w-[120px]">
                {p.tipo} {p.numero}/{p.ano}
              </span>
              <p className="flex-1 text-sm text-slate-700 line-clamp-2 leading-snug">
                {p.ementa ?? "Sem ementa disponível"}
              </p>
              <div className="flex-shrink-0 flex flex-col items-end gap-1 ml-2">
                {p.situacao && (
                  <span
                    className={`badge ${
                      p.aprovada
                        ? "badge-green"
                        : p.situacao === "arquivada"
                        ? "badge-gray"
                        : "badge-yellow"
                    }`}
                  >
                    {LABEL_SITUACAO[p.situacao] ?? p.situacao}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
