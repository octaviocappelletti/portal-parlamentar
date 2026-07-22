"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { REGIOES, META_BY_UF, type Regiao } from "@/lib/estados-data";

export interface StateFeature {
  uf: string;
  pathD: string;
  labelX: number;
  labelY: number;
}

const SVG_W = 600;
const SVG_H = 522;

export function EstadosMapa({ features }: { features: StateFeature[] }) {
  const router = useRouter();
  const [hoveredUf, setHoveredUf] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const [activeRegiao, setActiveRegiao] = useState<Regiao | null>(null);

  const handleMouseEnter = useCallback((uf: string, e: React.MouseEvent) => {
    setHoveredUf(uf);
    setTooltip({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredUf(null);
    setTooltip(null);
  }, []);

  const navigate = useCallback(
    (uf: string) => router.push(`/camara?uf=${uf}`),
    [router],
  );

  const toggleRegiao = useCallback(
    (r: Regiao) => setActiveRegiao((prev) => (prev === r ? null : r)),
    [],
  );

  const hoveredMeta = hoveredUf ? META_BY_UF[hoveredUf] : null;

  return (
    <div className="relative">
      {/* SVG do mapa */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full min-w-[280px]"
          aria-label="Mapa interativo do Brasil por estados"
          role="img"
        >
          {features.map(({ uf, pathD, labelX, labelY }) => {
            const meta = META_BY_UF[uf];
            if (!meta || !pathD) return null;

            const { bg, hover, border, text } = REGIOES[meta.regiao];
            const isHovered = hoveredUf === uf;
            const dimmed = activeRegiao !== null && meta.regiao !== activeRegiao;

            return (
              <g
                key={uf}
                role="button"
                tabIndex={0}
                aria-label={`Ver parlamentares de ${meta.nome}`}
                style={{ cursor: "pointer", outline: "none" }}
                onClick={() => navigate(uf)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(uf);
                  }
                }}
                onMouseEnter={(e) => handleMouseEnter(uf, e)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onFocus={(e) => {
                  setHoveredUf(uf);
                  const r = e.currentTarget.getBoundingClientRect();
                  setTooltip({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }}
                onBlur={() => {
                  setHoveredUf(null);
                  setTooltip(null);
                }}
              >
                <path
                  d={pathD}
                  fill={isHovered ? hover : bg}
                  stroke={isHovered ? "#1351B4" : border}
                  strokeWidth={isHovered ? 1.2 : 0.6}
                  fillRule="evenodd"
                  opacity={dimmed ? 0.22 : 1}
                  style={{ transition: "fill 0.12s, opacity 0.18s, stroke 0.12s" }}
                />
                {/* Sigla — omite DF pois o polígono é minúsculo */}
                {uf !== "DF" && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={uf === "SE" || uf === "AL" || uf === "ES" || uf === "RJ" ? 7 : 9}
                    fontWeight={700}
                    fill={isHovered ? "#1351B4" : text}
                    opacity={dimmed ? 0.3 : 0.85}
                    style={{ pointerEvents: "none", userSelect: "none", transition: "opacity 0.18s" }}
                  >
                    {uf}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip flutuante */}
      {hoveredMeta && tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg bg-white border border-border-base shadow-md flex items-center gap-2"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <span className="font-extrabold text-[13px] text-brand-blue">{hoveredMeta.uf}</span>
          <span className="text-[13px] text-text-strong font-semibold">{hoveredMeta.nome}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: REGIOES[hoveredMeta.regiao].bg,
              color: REGIOES[hoveredMeta.regiao].text,
            }}
          >
            {hoveredMeta.regiao}
          </span>
        </div>
      )}

      {/* Legenda clicável */}
      <div className="border-t border-border-base mt-4 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[12px] font-bold text-text-muted uppercase tracking-[0.04em]">
            Filtrar por região
          </p>
          {activeRegiao && (
            <button
              onClick={() => setActiveRegiao(null)}
              className="text-[12px] text-brand-blue font-semibold hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          {(Object.entries(REGIOES) as [Regiao, (typeof REGIOES)[Regiao]][]).map(
            ([regiao, { bg, border, text }]) => (
              <button
                key={regiao}
                onClick={() => toggleRegiao(regiao)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all hover:opacity-90"
                style={{
                  backgroundColor: bg,
                  border: `1.5px solid ${activeRegiao === regiao ? "#1351B4" : border}`,
                  color: text,
                  boxShadow: activeRegiao === regiao ? "0 0 0 2px #1351B4" : "none",
                }}
              >
                {regiao}
              </button>
            ),
          )}
        </div>
        <p className="text-[13px] text-text-muted mt-5">
          Ao clicar em um estado você verá os{" "}
          <strong>deputados federais</strong> eleitos por aquela UF. Use o botão{" "}
          <strong>Senado</strong> na página seguinte para alternar entre as duas casas.
        </p>
      </div>
    </div>
  );
}
