import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/db";
import AvatarFoto from "@/components/AvatarFoto";
import TabsNav from "@/components/TabsNav";
import RedesSociais from "@/components/RedesSociais";
import type { Parlamentar, ParlamentarOrgao } from "@/types";

export const revalidate = 86400;

const CASAS = {
  camara: { label: "Deputados", cargo: "Deputado(a) Federal" },
  senado: { label: "Senadores", cargo: "Senador(a)" },
} as const;

type Casa = keyof typeof CASAS;

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Ordenação por importância do cargo no órgão
const TITULO_PRIORIDADE: Record<string, number> = {
  "Presidente":         1,
  "1º Vice-Presidente": 2,
  "Vice-Presidente":    2,
  "2º Vice-Presidente": 3,
  "Coordenador":        4,
  "Titular":            5,
  "Suplente":           6,
};

function prioridadeTitulo(titulo: string | undefined): number {
  if (!titulo) return 99;
  for (const [key, val] of Object.entries(TITULO_PRIORIDADE)) {
    if (titulo.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 7;
}

function corTitulo(titulo: string | undefined): { bg: string; text: string } {
  const prio = prioridadeTitulo(titulo);
  if (prio <= 3) return { bg: "#e8f0fb", text: "#1351B4" };
  if (prio === 5) return { bg: "#eef2f7", text: "#33404f" };
  return { bg: "#f4f6f9", text: "#6b7a8d" };
}

type LayoutProps = {
  params: Promise<{ casa: string; id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ casa: string; id: string }>;
}): Promise<Metadata> {
  const { casa, id } = await params;
  const { data } = await supabase
    .from("parlamentar")
    .select("nome")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single();
  return { title: (data as { nome?: string } | null)?.nome ?? "Parlamentar" };
}

export default async function ParlamentarLayout({ params, children }: LayoutProps) {
  const { casa, id } = await params;
  if (!(casa in CASAS)) notFound();

  const casaKey = casa as Casa;
  const { label, cargo } = CASAS[casaKey];

  const { data: parlamentar } = await supabase
    .from("parlamentar")
    .select("*")
    .eq("casa", casa)
    .eq("id_externo", Number(id))
    .single<Parlamentar>();

  if (!parlamentar) notFound();

  // Órgãos ativos — Câmara e Senado
  const { data: orgaosData } = await supabase
    .from("parlamentar_orgao_ativo")
    .select("id_orgao, nome_orgao, sigla_orgao, titulo")
    .eq("parlamentar_id", parlamentar.id);

  const orgaos: ParlamentarOrgao[] = (orgaosData as ParlamentarOrgao[] | null) ?? [];

  const orgaosOrdenados = [...orgaos].sort(
    (a, b) => prioridadeTitulo(a.titulo) - prioridadeTitulo(b.titulo)
  );

  const basePath = `/${casa}/${id}`;

  const badgeEl = parlamentar.situacao ? (
    <span className="rounded-full bg-blue-bg text-brand-blue text-xs font-bold px-3 py-[5px]">
      {parlamentar.situacao}
    </span>
  ) : null;

  const cargoEl = (
    <p className="text-text-body">
      {cargo}
      {parlamentar.partido && <> · <strong>{parlamentar.partido}</strong></>}
      {parlamentar.uf && <> · {parlamentar.uf}</>}
    </p>
  );

  const redesEl = (
    <RedesSociais
      links={parlamentar.redes_sociais ?? []}
      website={parlamentar.website}
    />
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-surface-alt border-b border-border-base">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-[14px] text-[13px] text-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-text-strong transition-colors">Início</Link>
          <span>›</span>
          <Link href={`/${casa}`} className="hover:text-text-strong transition-colors">{label}</Link>
          <span>›</span>
          <span className="text-text-strong font-semibold truncate">{parlamentar.nome}</span>
        </div>
      </div>

      {/* Header do perfil */}
      <div className="max-w-[1180px] mx-auto px-4 sm:px-8 pt-7 sm:pt-9">
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 sm:items-start">

          {/* Mobile: avatar + nome lado a lado; Desktop: avatar isolado (sm:contents dissolve o wrapper) */}
          <div className="flex items-center gap-4 sm:contents">
            <AvatarFoto
              url={parlamentar.foto_url}
              iniciais={iniciais(parlamentar.nome)}
              size={110}
              rounded="rounded-2xl"
              fontSize={34}
            />

            {/* Nome visível apenas no mobile (ao lado do avatar) */}
            <div className="flex-1 sm:hidden">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-[22px] font-extrabold tracking-tight text-text-strong leading-tight">
                  {parlamentar.nome}
                </h1>
                {badgeEl}
              </div>
              <div className="text-[14px]">{cargoEl}</div>
              {redesEl}
            </div>
          </div>

          {/* Nome + redes visíveis apenas no desktop */}
          <div className="flex-1 hidden sm:block">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[30px] font-extrabold tracking-tight text-text-strong">
                {parlamentar.nome}
              </h1>
              {badgeEl}
            </div>
            <div className="text-[15px] mt-1.5">{cargoEl}</div>
            {redesEl}
          </div>

          {/* Botões: linha no mobile, coluna no desktop */}
          <div className="flex gap-2 sm:flex-col sm:gap-2.5 shrink-0">
            <button className="flex-1 sm:flex-none bg-brand-blue text-white px-5 py-[11px] rounded-lg font-bold text-sm hover:bg-[#0d3d96] transition-colors">
              Criar alerta
            </button>
            <button className="flex-1 sm:flex-none border border-border-input text-[#33404f] px-5 py-[11px] rounded-lg font-bold text-sm hover:bg-surface-alt transition-colors">
              Baixar dados
            </button>
          </div>
        </div>

        {/* Cargos e comissões */}
        {orgaosOrdenados.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-[12px] font-bold text-text-muted uppercase tracking-wide">
              Cargos e comissões
            </p>
            <div className="flex flex-wrap gap-2">
              {orgaosOrdenados.map((o) => {
                const { bg, text } = corTitulo(o.titulo);
                const nome = o.nome_orgao ?? o.sigla_orgao ?? `Órgão ${o.id_orgao}`;
                return (
                  <span
                    key={o.id_orgao}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1"
                    style={{ backgroundColor: bg, color: text }}
                    title={o.nome_orgao ?? undefined}
                  >
                    {o.titulo && (
                      <span className="font-bold">{o.titulo}</span>
                    )}
                    {o.titulo && <span className="opacity-40">·</span>}
                    <span className="truncate max-w-[220px]">{nome}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-[1180px] mx-auto px-4 sm:px-8 mt-6">
        <TabsNav basePath={basePath} />
      </div>

      {/* Conteúdo da aba */}
      {children}
    </div>
  );
}
