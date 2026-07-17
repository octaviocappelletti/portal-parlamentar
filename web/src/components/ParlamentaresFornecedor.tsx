"use client";

import type { Parlamentar } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface DespesaLinha {
  id: number;
  ano: number;
  mes: number;
  valor_liquido: number | null;
  valor_glosa: number | null;
  natureza: string | null;
  detalhamento: string | null;
  url_documento: string | null;
}

export interface ParlamentarGrupo {
  parlamentar: Parlamentar;
  total: number;
  lancamentos: number;
  despesas: DespesaLinha[];
}

export default function ParlamentaresFornecedor({ grupos }: { grupos: ParlamentarGrupo[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Parlamentares que contrataram ({grupos.length})
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {grupos.map(({ parlamentar: p, total, lancamentos, despesas }) => {
          const aberto = open.has(p.id);
          const ordenadas = [...despesas].sort((a, b) => b.ano - a.ano || b.mes - a.mes);

          return (
            <div key={p.id}>
              {/* Cabeçalho do parlamentar */}
              <button
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                {p.foto_url ? (
                  <Image
                    src={p.foto_url}
                    alt={p.nome}
                    width={36}
                    height={36}
                    className="rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
                    {p.nome.charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.nome}</p>
                  <p className="text-xs text-slate-400">
                    {[p.partido, p.uf, p.casa === "camara" ? "Câmara" : "Senado"]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <span className="text-xs text-slate-400 hidden sm:block flex-shrink-0 mr-2">
                  {lancamentos} lançamento{lancamentos !== 1 ? "s" : ""}
                </span>
                <span className="text-sm font-mono font-semibold text-slate-800 flex-shrink-0">
                  {BRL.format(total)}
                </span>
                <span
                  className={`text-slate-300 text-xs ml-2 flex-shrink-0 transition-transform duration-200 ${
                    aberto ? "rotate-90" : ""
                  }`}
                >
                  ▶
                </span>
              </button>

              {/* Tabela de lançamentos */}
              {aberto && (
                <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/50">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100/80">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">
                          Categoria
                        </th>
                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold w-20 hidden sm:table-cell">
                          Mês/Ano
                        </th>
                        <th className="text-right px-4 py-2.5 text-slate-500 font-semibold w-32">
                          Reembolsado
                        </th>
                        <th className="text-right px-4 py-2.5 text-slate-500 font-semibold w-24 hidden sm:table-cell">
                          Glosado
                        </th>
                        <th className="text-center px-4 py-2.5 text-slate-500 font-semibold w-14">
                          Doc.
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {ordenadas.map((d) => (
                        <tr key={d.id} className="hover:bg-white transition-colors">
                          <td className="px-4 py-2.5 align-top">
                            <Link
                              href={`/${p.casa}/${p.id_externo}/despesas/${d.id}`}
                              className="text-slate-800 hover:text-blue-600 hover:underline font-medium block truncate max-w-[220px]"
                              title={d.natureza ?? ""}
                            >
                              {d.natureza ?? "—"}
                            </Link>
                            {d.detalhamento && (
                              <span
                                className="text-slate-400 block truncate max-w-[220px]"
                                title={d.detalhamento}
                              >
                                {d.detalhamento}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-2.5 text-slate-400 align-top hidden sm:table-cell whitespace-nowrap">
                            {MESES[d.mes]}/{d.ano}
                          </td>

                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800 align-top whitespace-nowrap">
                            {BRL.format(d.valor_liquido ?? 0)}
                          </td>

                          <td className="px-4 py-2.5 text-right font-mono align-top hidden sm:table-cell whitespace-nowrap">
                            {(d.valor_glosa ?? 0) > 0 ? (
                              <span className="text-red-500">
                                −{BRL.format(d.valor_glosa!)}
                              </span>
                            ) : (
                              <span className="text-slate-200">—</span>
                            )}
                          </td>

                          <td className="px-4 py-2.5 text-center align-top">
                            {d.url_documento ? (
                              <a
                                href={d.url_documento}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver documento original (fonte oficial)"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-bold"
                              >
                                ↗
                              </a>
                            ) : (
                              <span className="text-slate-200 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot className="border-t border-slate-200 bg-slate-100/80">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 text-xs text-slate-400">
                          {lancamentos} lançamento{lancamentos !== 1 ? "s" : ""} ·{" "}
                          <Link
                            href={`/${p.casa}/${p.id_externo}`}
                            className="text-blue-600 hover:underline"
                          >
                            ver perfil
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                          {BRL.format(total)}
                        </td>
                        <td className="hidden sm:table-cell" />
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
