import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/db";
import AvatarFoto from "@/components/AvatarFoto";
import TabsNav from "@/components/TabsNav";
import type { Parlamentar } from "@/types";

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

  const basePath = `/${casa}/${id}`;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-surface-alt border-b border-border-base">
        <div className="max-w-[1180px] mx-auto px-8 py-[14px] text-[13px] text-text-muted flex items-center gap-2">
          <Link href="/" className="hover:text-text-strong transition-colors">Início</Link>
          <span>›</span>
          <Link href={`/${casa}`} className="hover:text-text-strong transition-colors">{label}</Link>
          <span>›</span>
          <span className="text-text-strong font-semibold">{parlamentar.nome}</span>
        </div>
      </div>

      {/* Header do perfil */}
      <div className="max-w-[1180px] mx-auto px-8 pt-9">
        <div className="flex gap-7 items-start">
          <AvatarFoto
            url={parlamentar.foto_url}
            iniciais={iniciais(parlamentar.nome)}
            size={110}
            rounded="rounded-2xl"
            fontSize={34}
          />

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[30px] font-extrabold tracking-tight text-text-strong">
                {parlamentar.nome}
              </h1>
              {parlamentar.situacao && (
                <span className="rounded-full bg-blue-bg text-brand-blue text-xs font-bold px-3 py-[5px]">
                  {parlamentar.situacao}
                </span>
              )}
            </div>
            <p className="text-[15px] text-text-body mt-1.5">
              {cargo}
              {parlamentar.partido && <> · <strong>{parlamentar.partido}</strong></>}
              {parlamentar.uf && <> · {parlamentar.uf}</>}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 shrink-0">
            <button className="bg-brand-blue text-white px-5 py-[11px] rounded-lg font-bold text-sm hover:bg-[#0d3d96] transition-colors">
              Criar alerta
            </button>
            <button className="border border-border-input text-[#33404f] px-5 py-[11px] rounded-lg font-bold text-sm hover:bg-surface-alt transition-colors">
              Baixar dados
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-[1180px] mx-auto px-8 mt-6">
        <TabsNav basePath={basePath} />
      </div>

      {/* Conteúdo da aba */}
      {children}
    </div>
  );
}
