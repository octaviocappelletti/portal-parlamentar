import { supabase } from "@/lib/db";
import type { Despesa } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 604800;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const LABELS_CASA: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
};

interface Props {
  params: Promise<{ casa: string; id: string; despesaId: string }>;
}

export default async function DespesaPage({ params }: Props) {
  const { casa, id, despesaId } = await params;

  const { data: parlamentar } = await supabase
    .from("parlamentar")
    .select("id, nome")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single();

  if (!parlamentar) notFound();

  const { data: despesa } = await supabase
    .from("despesa")
    .select("*")
    .eq("id", Number(despesaId))
    .eq("parlamentar_id", parlamentar.id)
    .single<Despesa>();

  if (!despesa) notFound();

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <nav aria-label="Localização" className="text-sm text-slate-500 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-slate-700 transition-colors">Início</Link>
        <span>/</span>
        <Link href={`/${casa}`} className="hover:text-slate-700 transition-colors">{LABELS_CASA[casa] ?? casa}</Link>
        <span>/</span>
        <Link href={`/${casa}/${id}`} className="hover:text-slate-700 transition-colors">{parlamentar.nome}</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium truncate">Despesa</span>
      </nav>

      <div className="card p-6 mb-5">
        <h1 className="text-xl font-bold text-slate-900 leading-tight">
          {despesa.natureza ?? "Despesa"}
        </h1>
        {despesa.detalhamento && (
          <p className="text-sm text-slate-500 mt-1.5">{despesa.detalhamento}</p>
        )}
      </div>

      <div className="card overflow-hidden mb-5">
        <dl className="divide-y divide-slate-100">
          <Row label="Competência" value={`${MESES[despesa.mes]} / ${despesa.ano}`} />
          <Row
            label="Valor reembolsado"
            value={
              <span className="font-semibold font-mono text-slate-900">
                {BRL.format(despesa.valor_liquido ?? 0)}
              </span>
            }
          />
          {(despesa.valor_glosa ?? 0) > 0 && (
            <Row
              label="Valor glosado"
              value={
                <span className="text-red-600 font-medium font-mono">
                  {BRL.format(despesa.valor_glosa ?? 0)}
                </span>
              }
            />
          )}
          <Row label="Fornecedor" value={despesa.fornecedor ?? "—"} />
          {despesa.cpf_cnpj && (
            <Row label="CPF / CNPJ" value={<span className="font-mono">{despesa.cpf_cnpj}</span>} />
          )}
        </dl>
      </div>

      {despesa.url_documento ? (
        <a
          href={despesa.url_documento}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-marinho-700 text-white rounded-lg hover:bg-marinho-800 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marinho-600 focus-visible:ring-offset-2"
        >
          Ver documento original (fonte oficial) ↗
        </a>
      ) : (
        <p className="text-sm text-slate-500">Documento não disponível.</p>
      )}

      <p className="text-xs text-slate-500 mt-8">
        Cota para Exercício da Atividade Parlamentar (CEAP) — {LABELS_CASA[casa] ?? casa}.
        Fonte oficial.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-5 py-3.5 items-baseline">
      <dt className="text-xs text-slate-500 font-medium">{label}</dt>
      <dd className="col-span-2 text-sm text-slate-800">{value}</dd>
    </div>
  );
}
