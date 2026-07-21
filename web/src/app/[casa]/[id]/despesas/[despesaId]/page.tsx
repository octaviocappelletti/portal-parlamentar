import { supabase } from "@/lib/db";
import type { Despesa } from "@/types";
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
    <div className="max-w-[1180px] mx-auto px-8 py-8">
      <div className="max-w-2xl">
        <div className="border border-border-base rounded-xl p-6 mb-5">
          <h2 className="text-xl font-bold text-text-strong leading-tight">
            {despesa.natureza ?? "Despesa"}
          </h2>
          {despesa.detalhamento && (
            <p className="text-sm text-text-body mt-1.5">{despesa.detalhamento}</p>
          )}
        </div>

        <div className="border border-border-base rounded-xl overflow-hidden mb-5">
          <dl className="divide-y divide-border-base">
            <Row label="Competência" value={`${MESES[despesa.mes]} / ${despesa.ano}`} />
            <Row
              label="Valor reembolsado"
              value={
                <span className="font-bold text-text-strong">
                  {BRL.format(despesa.valor_liquido ?? 0)}
                </span>
              }
            />
            {(despesa.valor_glosa ?? 0) > 0 && (
              <Row
                label="Valor glosado"
                value={
                  <span className="text-danger font-semibold">
                    {BRL.format(despesa.valor_glosa ?? 0)}
                  </span>
                }
              />
            )}
            <Row label="Fornecedor" value={despesa.fornecedor ?? "—"} />
            {despesa.cpf_cnpj && (
              <Row label="CPF / CNPJ" value={<span className="font-mono text-sm">{despesa.cpf_cnpj}</span>} />
            )}
          </dl>
        </div>

        {despesa.url_documento ? (
          <a
            href={despesa.url_documento}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-[11px] bg-brand-blue text-white rounded-lg hover:bg-[#0d3d96] text-sm font-bold transition-colors"
          >
            Ver documento original (fonte oficial) ↗
          </a>
        ) : (
          <p className="text-sm text-text-muted">Documento não disponível.</p>
        )}

        <p className="text-xs text-text-muted mt-8">
          Cota para Exercício da Atividade Parlamentar (CEAP) — {LABELS_CASA[casa] ?? casa}.
          Fonte oficial.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-5 py-3.5 items-baseline">
      <dt className="text-xs text-text-muted font-semibold">{label}</dt>
      <dd className="col-span-2 text-sm text-text-strong">{value}</dd>
    </div>
  );
}
