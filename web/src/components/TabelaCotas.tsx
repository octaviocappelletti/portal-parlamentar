"use client";

import { supabase } from "@/lib/db";
import type { Casa, Despesa, DespesaResumoAno } from "@/types";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

// ── Formatadores ─────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const MESES_ABR = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_EXT = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function formatDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "***.$2.$3-**");
  return doc;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  resumoAno: DespesaResumoAno[];
  casa: Casa;
  parlamentarId: number;    // id_externo — para URLs
  parlamentarDbId: number;  // id interno — para queries
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function TabelaCotas({
  resumoAno,
  casa,
  parlamentarId,
  parlamentarDbId,
}: Props) {
  const ANO_ATUAL = new Date().getFullYear();
  const MES_ATUAL = new Date().getMonth() + 1;

  const anos = useMemo(
    () => resumoAno.map((r) => r.ano).sort((a, b) => b - a),
    [resumoAno]
  );

  const [anoSel, setAnoSel] = useState<number>(anos[0] ?? ANO_ATUAL);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [openMonths, setOpenMonths] = useState<Set<number>>(new Set());
  const prevAno = useRef<number | null>(null);

  // Lazy-load despesas ao trocar de ano
  useEffect(() => {
    if (!anoSel || !parlamentarDbId) return;

    setLoading(true);
    setDespesas([]);
    setBusca("");
    setErro(null);

    // Auto-abre o mês atual se for o ano corrente; caso contrário, colapsa tudo
    setOpenMonths(anoSel === ANO_ATUAL ? new Set([MES_ATUAL]) : new Set());
    prevAno.current = anoSel;

    supabase
      .from("despesa")
      .select("*")
      .eq("parlamentar_id", parlamentarDbId)
      .eq("ano", anoSel)
      .order("mes", { ascending: false })
      .order("valor_liquido", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErro(error.message); setLoading(false); return; }
        setDespesas((data as Despesa[]) ?? []);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoSel, parlamentarDbId]);

  const resumoSel = useMemo(
    () => resumoAno.find((r) => r.ano === anoSel),
    [resumoAno, anoSel]
  );

  const totalHistorico = useMemo(
    () => resumoAno.reduce((s, r) => s + (r.total ?? 0), 0),
    [resumoAno]
  );

  // Filtragem por texto
  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return despesas;
    return despesas.filter(
      (d) =>
        (d.natureza ?? "").toLowerCase().includes(termo) ||
        (d.fornecedor ?? "").toLowerCase().includes(termo) ||
        (d.detalhamento ?? "").toLowerCase().includes(termo) ||
        (d.cpf_cnpj ?? "").includes(termo)
    );
  }, [despesas, busca]);

  // Agrupamento por mês
  const porMes = useMemo(() => {
    const map = new Map<number, { total: number; glosa: number; itens: Despesa[] }>();
    for (const d of filtradas) {
      const entry = map.get(d.mes) ?? { total: 0, glosa: 0, itens: [] };
      entry.total += d.valor_liquido ?? 0;
      entry.glosa += d.valor_glosa ?? 0;
      entry.itens.push(d);
      map.set(d.mes, entry);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtradas]);

  // Top categorias
  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of despesas) {
      const cat = d.natureza ?? "Outros";
      map.set(cat, (map.get(cat) ?? 0) + (d.valor_liquido ?? 0));
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([cat, val]) => ({ cat, val }));
  }, [despesas]);

  // Top fornecedores
  const porFornecedor = useMemo(() => {
    const map = new Map<string, { total: number; qtd: number }>();
    for (const d of despesas) {
      const f = d.fornecedor ?? "Sem identificação";
      const entry = map.get(f) ?? { total: 0, qtd: 0 };
      entry.total += d.valor_liquido ?? 0;
      entry.qtd += 1;
      map.set(f, entry);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([nome, { total, qtd }]) => ({ nome, total, qtd }));
  }, [despesas]);

  const totalFiltrado = filtradas.reduce((s, d) => s + (d.valor_liquido ?? 0), 0);
  const totalGlosa = despesas.reduce((s, d) => s + (d.valor_glosa ?? 0), 0);
  const maiorDespesa = despesas.length > 0
    ? Math.max(...despesas.map((d) => d.valor_liquido ?? 0))
    : 0;
  const mediaMensal = porMes.length > 0
    ? (resumoSel?.total ?? 0) / porMes.length
    : 0;

  const toggleMes = (mes: number) =>
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mes)) next.delete(mes); else next.add(mes);
      return next;
    });

  if (resumoAno.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        Nenhuma despesa registrada.
      </div>
    );
  }

  const dadosGrafico = resumoAno
    .slice()
    .sort((a, b) => a.ano - b.ano)
    .map((r) => ({ ano: r.ano, total: r.total }));

  return (
    <div className="space-y-5">
      {/* ── Timeline de anos ─────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Histórico — {anos.length} ano{anos.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-slate-500">
            Total geral:{" "}
            <span className="font-bold text-slate-800">{BRL0.format(totalHistorico)}</span>
          </p>
        </div>

        {/* Mini bar chart histórico */}
        <ResponsiveContainer width="100%" height={80}>
          <BarChart
            data={dadosGrafico}
            barCategoryGap="30%"
            margin={{ top: 2, right: 4, left: -16, bottom: 0 }}
            onClick={(e) => {
              const payload = (e as { activePayload?: { payload: { ano: number } }[] })
                ?.activePayload?.[0]?.payload;
              if (payload) setAnoSel(payload.ano);
            }}
          >
            <XAxis
              dataKey="ano"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
              formatter={(v) => [BRL0.format(Number(v)), "total"]}
              labelFormatter={(l) => `Ano ${l}`}
            />
            <Bar dataKey="total" radius={[3, 3, 0, 0]} style={{ cursor: "pointer" }}>
              {dadosGrafico.map((r) => (
                <Cell key={r.ano} fill={anoSel === r.ano ? "#1d4ed8" : "#3b82f6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Botões de ano com total */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {anos.map((a) => {
            const r = resumoAno.find((x) => x.ano === a);
            return (
              <button
                key={a}
                onClick={() => setAnoSel(a)}
                className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs transition-all ${
                  anoSel === a
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span className="font-bold">{a}</span>
                <span className={`text-[10px] mt-0.5 ${anoSel === a ? "text-blue-200" : "text-slate-400"}`}>
                  {BRL0.format(r?.total ?? 0)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Conteúdo do ano selecionado ──────────────────────────────────── */}
      {loading && (
        <div className="card p-12 text-center text-slate-400 text-sm animate-pulse">
          Carregando despesas de {anoSel}…
        </div>
      )}

      {erro && (
        <div className="card p-6 text-center text-red-500 text-sm">
          Erro ao carregar: {erro}
        </div>
      )}

      {!loading && !erro && despesas.length > 0 && (
        <>
          {/* Cards de resumo do ano */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label={`Total ${anoSel}`}
              value={BRL0.format(resumoSel?.total ?? 0)}
              sub={`${resumoSel?.lancamentos ?? 0} lançamentos`}
            />
            <StatCard
              label="Média mensal"
              value={BRL0.format(mediaMensal)}
              sub={`em ${porMes.length} mês${porMes.length !== 1 ? "es" : ""} com gastos`}
            />
            <StatCard
              label="Maior despesa"
              value={BRL.format(maiorDespesa)}
              sub="valor único mais alto"
              destaque
            />
            <StatCard
              label="Valor glosado"
              value={BRL.format(totalGlosa)}
              sub={totalGlosa > 0 ? "rejeitado pela Mesa" : "sem glosas"}
              alerta={totalGlosa > 0}
            />
          </div>

          {/* Por categoria */}
          {porCategoria.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Distribuição por categoria
              </p>
              <div className="space-y-3">
                {porCategoria.map(({ cat, val }) => {
                  const pct = (resumoSel?.total ?? 0) > 0
                    ? Math.round((val / (resumoSel!.total)) * 100)
                    : 0;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span
                        className="text-sm text-slate-600 flex-shrink-0 truncate"
                        style={{ width: "200px" }}
                        title={cat}
                      >
                        {cat}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right flex-shrink-0">
                        {pct}%
                      </span>
                      <span className="text-sm font-mono text-slate-700 flex-shrink-0 w-32 text-right">
                        {BRL.format(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top fornecedores */}
          {porFornecedor.length > 0 && (
            <div className="card p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Principais fornecedores
              </p>
              <div className="divide-y divide-slate-50">
                {porFornecedor.map(({ nome, total, qtd }) => (
                  <div key={nome} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate font-medium" title={nome}>
                        {nome}
                      </p>
                      <p className="text-xs text-slate-400">{qtd} pagamento{qtd !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-slate-800 flex-shrink-0">
                      {BRL.format(total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Busca */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="search"
              placeholder="Buscar por categoria, fornecedor ou detalhamento…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input flex-1 min-w-[260px]"
            />
            <span className="text-xs text-slate-400">
              {busca
                ? `${filtradas.length} resultado${filtradas.length !== 1 ? "s" : ""} · ${BRL.format(totalFiltrado)}`
                : `${despesas.length} lançamentos`}
            </span>
          </div>

          {/* Acordeão por mês */}
          {porMes.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Nenhum lançamento encontrado para a busca.
            </div>
          ) : (
            <div className="card overflow-hidden divide-y divide-slate-100">
              {porMes.map(([mes, { total, glosa, itens }]) => {
                const aberto = openMonths.has(mes);
                return (
                  <div key={mes}>
                    {/* Cabeçalho do mês */}
                    <button
                      onClick={() => toggleMes(mes)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="text-sm font-bold text-slate-700 w-28 flex-shrink-0">
                        {MESES_EXT[mes]}
                      </span>
                      <span className="text-xs text-slate-400">
                        {itens.length} lançamento{itens.length !== 1 ? "s" : ""}
                      </span>
                      {glosa > 0 && (
                        <span className="text-xs text-red-400 font-medium">
                          glosa: {BRL.format(glosa)}
                        </span>
                      )}
                      <span className="ml-auto text-sm font-mono font-semibold text-slate-800">
                        {BRL.format(total)}
                      </span>
                      <span
                        className={`text-slate-300 text-xs ml-2 transition-transform duration-200 ${
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
                              <th className="text-left px-4 py-2.5 text-slate-500 font-semibold w-44">
                                Categoria
                              </th>
                              <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">
                                Fornecedor
                              </th>
                              <th className="text-left px-4 py-2.5 text-slate-500 font-semibold w-36 hidden lg:table-cell">
                                CNPJ / CPF
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
                            {itens.map((d) => (
                              <tr
                                key={d.id}
                                className="hover:bg-white transition-colors"
                              >
                                {/* Categoria + detalhamento */}
                                <td className="px-4 py-2.5 align-top">
                                  <Link
                                    href={`/${casa}/${parlamentarId}/despesas/${d.id}`}
                                    className="text-slate-800 hover:text-blue-600 hover:underline font-medium block truncate max-w-[170px]"
                                    title={d.natureza ?? ""}
                                  >
                                    {d.natureza ?? "—"}
                                  </Link>
                                  {d.detalhamento && (
                                    <span
                                      className="text-slate-400 block truncate max-w-[170px]"
                                      title={d.detalhamento}
                                    >
                                      {d.detalhamento}
                                    </span>
                                  )}
                                </td>

                                {/* Fornecedor */}
                                <td className="px-4 py-2.5 align-top">
                                  {(() => {
                                    const cnpj = (d.cpf_cnpj ?? "").replace(/\D/g, "");
                                    return cnpj.length === 14 ? (
                                      <Link
                                        href={`/fornecedor/${cnpj}`}
                                        className="text-slate-700 hover:text-blue-600 hover:underline block truncate max-w-[220px]"
                                        title={d.fornecedor ?? ""}
                                      >
                                        {d.fornecedor ?? "—"}
                                      </Link>
                                    ) : (
                                      <span
                                        className="text-slate-700 block truncate max-w-[220px]"
                                        title={d.fornecedor ?? ""}
                                      >
                                        {d.fornecedor ?? "—"}
                                      </span>
                                    );
                                  })()}
                                </td>

                                {/* CNPJ/CPF */}
                                <td className="px-4 py-2.5 font-mono text-slate-400 align-top hidden lg:table-cell whitespace-nowrap">
                                  {d.cpf_cnpj ? formatDoc(d.cpf_cnpj) : "—"}
                                </td>

                                {/* Valor reembolsado */}
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800 align-top whitespace-nowrap">
                                  {BRL.format(d.valor_liquido ?? 0)}
                                </td>

                                {/* Valor glosado */}
                                <td className="px-4 py-2.5 text-right font-mono align-top hidden sm:table-cell whitespace-nowrap">
                                  {(d.valor_glosa ?? 0) > 0 ? (
                                    <span className="text-red-500">
                                      −{BRL.format(d.valor_glosa!)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-200">—</span>
                                  )}
                                </td>

                                {/* Link para documento original */}
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

                          {/* Rodapé do mês */}
                          <tfoot className="border-t border-slate-200 bg-slate-100/80">
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-xs text-slate-400 hidden lg:table-cell"
                              >
                                {itens.length} lançamento{itens.length !== 1 ? "s" : ""} em{" "}
                                {MESES_ABR[mes]}
                              </td>
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-xs text-slate-400 table-cell lg:hidden"
                              >
                                {itens.length} lançamento{itens.length !== 1 ? "s" : ""} em{" "}
                                {MESES_ABR[mes]}
                              </td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                                {BRL.format(total)}
                              </td>
                              {glosa > 0 ? (
                                <td className="px-4 py-2 text-right font-mono text-red-500 text-xs whitespace-nowrap hidden sm:table-cell">
                                  −{BRL.format(glosa)}
                                </td>
                              ) : (
                                <td className="hidden sm:table-cell" />
                              )}
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
          )}

          {/* Nota de transparência */}
          <p className="text-xs text-slate-400 text-center pt-2">
            Dados da Cota para Exercício da Atividade Parlamentar (CEAP) —{" "}
            {casa === "camara" ? "Câmara dos Deputados" : "Senado Federal"}.
            Fonte oficial. Atualizado periodicamente.
          </p>
        </>
      )}

      {!loading && !erro && despesas.length === 0 && anoSel && (
        <div className="card p-10 text-center text-slate-400 text-sm">
          Nenhum lançamento registrado em {anoSel}.
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  destaque,
  alerta,
}: {
  label: string;
  value: string;
  sub: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-xl font-bold leading-tight break-all ${
          alerta ? "text-red-600" : destaque ? "text-orange-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}
