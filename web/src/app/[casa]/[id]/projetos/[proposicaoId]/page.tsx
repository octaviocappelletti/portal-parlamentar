import { supabase } from "@/lib/db";
import type { Proposicao } from "@/types";
import { notFound } from "next/navigation";

export const revalidate = 86400;

interface Props {
  params: Promise<{ casa: string; id: string; proposicaoId: string }>;
}

const LABELS_CASA: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  "Aprovado":       { bg: "#e7f4ea", text: "#168821" },
  "Em tramitação":  { bg: "#fef9e7", text: "#7d5a00" },
  "Arquivado":      { bg: "#eef2f7", text: "#54606e" },
};

function resolveStatus(p: Proposicao): string {
  if (p.aprovada) return "Aprovado";
  if (/arquiv/i.test(p.situacao ?? "")) return "Arquivado";
  return "Em tramitação";
}

export default async function ProposicaoPage({ params }: Props) {
  const { casa, proposicaoId } = await params;

  const { data: proposicao } = await supabase
    .from("proposicao")
    .select("*")
    .eq("id", Number(proposicaoId))
    .single<Proposicao>();

  if (!proposicao) notFound();

  const statusStr = resolveStatus(proposicao);
  const badge = STATUS_BADGE[statusStr] ?? { bg: "#eef2f7", text: "#54606e" };

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-8">
      <div className="max-w-3xl">
        <div className="border border-border-base rounded-xl p-6 mb-5">
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <span className="font-bold text-lg text-text-strong">
              {proposicao.tipo} {proposicao.numero}/{proposicao.ano}
            </span>
            <span
              className="text-[11px] font-bold px-[9px] py-1 rounded-[6px]"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              {statusStr}
            </span>
            {proposicao.autor_principal === false && (
              <span className="text-[11px] font-bold px-[9px] py-1 rounded-[6px] bg-surface-alt text-text-muted">
                Coautor
              </span>
            )}
          </div>

          {proposicao.ementa && (
            <p className="text-text-body leading-relaxed">{proposicao.ementa}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {proposicao.data_apresentacao && (
            <p className="text-sm text-text-muted">
              Apresentada em{" "}
              <span className="text-text-strong font-semibold">
                {new Date(proposicao.data_apresentacao).toLocaleDateString("pt-BR")}
              </span>
            </p>
          )}

          {proposicao.url_inteiro_teor ? (
            <a
              href={proposicao.url_inteiro_teor}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-[11px] bg-brand-blue text-white rounded-lg hover:bg-[#0d3d96] text-sm font-bold transition-colors"
            >
              Ver íntegra (fonte oficial) ↗
            </a>
          ) : (
            <p className="text-sm text-text-muted">Íntegra não disponível.</p>
          )}
        </div>

        <p className="text-xs text-text-muted mt-8">
          {LABELS_CASA[casa] ?? casa} — Fonte oficial.
        </p>
      </div>
    </div>
  );
}
