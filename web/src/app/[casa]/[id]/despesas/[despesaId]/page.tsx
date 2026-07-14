import { supabase } from "@/lib/db";
import type { Despesa } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 604800; // 1 semana

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  params: Promise<{ casa: string; id: string; despesaId: string }>;
}

export default async function DespesaPage({ params }: Props) {
  const { casa, id, despesaId } = await params;

  const { data: despesa } = await supabase
    .from("despesa")
    .select("*")
    .eq("id", Number(despesaId))
    .single<Despesa>();

  if (!despesa) notFound();

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <Link href={`/${casa}/${id}`} className="text-sm text-blue-600 hover:underline mb-6 block">
        &larr; Voltar ao parlamentar
      </Link>

      <h1 className="text-xl font-bold mb-6">Despesa — {despesa.natureza}</h1>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <div>
          <dt className="text-gray-400">Competência</dt>
          <dd>{MESES[despesa.mes]}/{despesa.ano}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Valor reembolsado</dt>
          <dd className="font-semibold">{BRL.format(despesa.valor_liquido ?? 0)}</dd>
        </div>
        {(despesa.valor_glosa ?? 0) > 0 && (
          <div>
            <dt className="text-gray-400">Valor glosado</dt>
            <dd className="text-red-600">{BRL.format(despesa.valor_glosa ?? 0)}</dd>
          </div>
        )}
        <div>
          <dt className="text-gray-400">Fornecedor</dt>
          <dd>{despesa.fornecedor ?? "—"}</dd>
        </div>
        {despesa.cpf_cnpj && (
          <div>
            <dt className="text-gray-400">CPF/CNPJ</dt>
            <dd className="font-mono">{despesa.cpf_cnpj}</dd>
          </div>
        )}
        {despesa.detalhamento && (
          <div className="col-span-2">
            <dt className="text-gray-400">Detalhamento</dt>
            <dd>{despesa.detalhamento}</dd>
          </div>
        )}
      </dl>

      {despesa.url_documento ? (
        <a
          href={despesa.url_documento}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Ver nota fiscal / documento (fonte oficial)
        </a>
      ) : (
        <p className="mt-8 text-sm text-gray-400">Documento não disponível.</p>
      )}
    </main>
  );
}
