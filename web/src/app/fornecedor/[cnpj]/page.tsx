import { supabase } from "@/lib/db";
import type { Fornecedor, Parlamentar } from "@/types";
import ParlamentaresFornecedor, {
  type DespesaLinha,
  type ParlamentarGrupo,
} from "@/components/ParlamentaresFornecedor";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 86400;

const BRL0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const SITUACAO_CADASTRAL: Record<string, { label: string; cls: string }> = {
  "01": { label: "Nula",     cls: "bg-slate-100 text-slate-500" },
  "02": { label: "Ativa",    cls: "bg-green-100 text-green-700" },
  "03": { label: "Suspensa", cls: "bg-amber-100 text-amber-700" },
  "04": { label: "Inapta",   cls: "bg-red-100 text-red-600" },
  "08": { label: "Baixada",  cls: "bg-red-100 text-red-600" },
};

const PORTE: Record<string, string> = {
  "01": "Micro Empresa",
  "03": "Pequeno Porte",
  "05": "Grande Empresa",
};

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

interface Props {
  params: Promise<{ cnpj: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cnpj } = await params;
  const { data } = await supabase
    .from("despesa")
    .select("fornecedor")
    .eq("cnpj_normalizado", cnpj)
    .not("fornecedor", "is", null)
    .limit(1)
    .single();
  return { title: data?.fornecedor ?? formatCnpj(cnpj) };
}

interface DespesaRow {
  id: number;
  parlamentar_id: number;
  ano: number;
  mes: number;
  valor_liquido: number | null;
  valor_glosa: number | null;
  natureza: string | null;
  fornecedor: string | null;
  detalhamento: string | null;
  url_documento: string | null;
  parlamentar: Parlamentar;
}

export default async function FornecedorPage({ params }: Props) {
  const { cnpj } = await params;

  if (!/^\d{14}$/.test(cnpj)) notFound();

  const [{ data: despesasRaw, error: errDespesas }, { data: infoReceita }] = await Promise.all([
    supabase
      .from("despesa")
      .select(
        "id, parlamentar_id, ano, mes, valor_liquido, valor_glosa, natureza, detalhamento, url_documento, fornecedor, parlamentar(id, id_externo, nome, partido, uf, casa, foto_url)"
      )
      .eq("cnpj_normalizado", cnpj),
    supabase
      .from("fornecedor")
      .select("*")
      .eq("cnpj", cnpj)
      .maybeSingle<Fornecedor>(),
  ]);

  if (errDespesas) throw new Error(errDespesas.message);
  if (!despesasRaw?.length) notFound();

  const despesas = despesasRaw as unknown as DespesaRow[];

  const nomeFornecedor =
    despesas.find((d) => d.fornecedor)?.fornecedor ?? formatCnpj(cnpj);

  // Totais globais
  const totalRecebido = despesas.reduce((s, d) => s + (d.valor_liquido ?? 0), 0);

  // Agrupamento por parlamentar — inclui array de despesas para o acordeão
  const porParlamentar = new Map<number, ParlamentarGrupo>();
  for (const d of despesas) {
    if (!d.parlamentar) continue;
    const entry = porParlamentar.get(d.parlamentar_id) ?? {
      parlamentar: d.parlamentar,
      total: 0,
      lancamentos: 0,
      despesas: [] as DespesaLinha[],
    };
    entry.total += d.valor_liquido ?? 0;
    entry.lancamentos += 1;
    entry.despesas.push({
      id: d.id,
      ano: d.ano,
      mes: d.mes,
      valor_liquido: d.valor_liquido,
      valor_glosa: d.valor_glosa,
      natureza: d.natureza,
      detalhamento: d.detalhamento,
      url_documento: d.url_documento,
    });
    porParlamentar.set(d.parlamentar_id, entry);
  }
  const grupos = [...porParlamentar.values()].sort((a, b) => b.total - a.total);

  // Agrupamento por ano para o gráfico
  const porAno = new Map<number, number>();
  for (const d of despesas) {
    porAno.set(d.ano, (porAno.get(d.ano) ?? 0) + (d.valor_liquido ?? 0));
  }
  const anos = [...porAno.entries()].sort((a, b) => b[0] - a[0]);
  const maiorAno = anos.length > 0 ? Math.max(...anos.map(([, v]) => v)) : 1;

  const situacao = infoReceita?.situacao_cadastral
    ? (SITUACAO_CADASTRAL[infoReceita.situacao_cadastral] ?? null)
    : null;
  const porte = infoReceita?.porte_empresa ? (PORTE[infoReceita.porte_empresa] ?? null) : null;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-400 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-slate-600">Início</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium truncate max-w-xs">{nomeFornecedor}</span>
      </nav>

      {/* Header */}
      <div className="card p-6 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">{nomeFornecedor}</h1>
        <p className="text-sm text-slate-400 font-mono mt-1">{formatCnpj(cnpj)}</p>

        {infoReceita && (
          <div className="flex flex-wrap gap-2 mt-3">
            {situacao && (
              <span className={`badge ${situacao.cls}`}>{situacao.label}</span>
            )}
            {porte && <span className="badge badge-gray">{porte}</span>}
            {infoReceita.municipio && infoReceita.uf && (
              <span className="badge badge-gray">
                {infoReceita.municipio}/{infoReceita.uf}
              </span>
            )}
            {infoReceita.cnae_principal && (
              <span className="badge badge-gray">CNAE {infoReceita.cnae_principal}</span>
            )}
            {infoReceita.data_inicio_atividade && (
              <span className="badge badge-gray">
                Desde{" "}
                {new Date(infoReceita.data_inicio_atividade).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
            Total recebido
          </p>
          <p className="text-xl font-bold text-slate-900">{BRL0.format(totalRecebido)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
            Parlamentares
          </p>
          <p className="text-xl font-bold text-slate-900">{grupos.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
            Lançamentos
          </p>
          <p className="text-xl font-bold text-slate-900">{despesas.length}</p>
        </div>
      </div>

      {/* Histórico por ano */}
      <div className="card p-5 mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Histórico por ano
        </p>
        <div className="space-y-2.5">
          {anos.map(([ano, total]) => {
            const pct = Math.round((total / maiorAno) * 100);
            return (
              <div key={ano} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 font-mono w-10 flex-shrink-0">{ano}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-slate-700 w-32 text-right flex-shrink-0">
                  {BRL0.format(total)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Acordeão de parlamentares — client component */}
      <ParlamentaresFornecedor grupos={grupos} />

      <p className="text-xs text-slate-400 text-center pt-6">
        Dados da Cota para Exercício da Atividade Parlamentar (CEAP) —
        Câmara dos Deputados e Senado Federal. Fonte oficial. Atualizado periodicamente.
      </p>
    </main>
  );
}
