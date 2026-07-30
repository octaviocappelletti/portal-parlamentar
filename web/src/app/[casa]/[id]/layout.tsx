import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch, apiFetchOptional } from "@/lib/api";
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

const ID_RE = /^\d{1,10}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ casa: string; id: string }>;
}): Promise<Metadata> {
  const { casa, id } = await params;
  if (!(casa in CASAS) || !ID_RE.test(id)) return {};
  const casaKey = casa as Casa;
  const parl = await apiFetchOptional<{ nome: string; partido?: string; uf?: string; foto_url?: string }>(
    `/parlamentares/${casa}/${id}`, 86400,
  );
  if (!parl) return {};

  const cargo = CASAS[casaKey].cargo;
  const titulo = parl.nome;
  const descricao = [
    cargo,
    parl.partido,
    parl.uf,
    "— gastos, proposições e presença no Capivara Parlamentar.",
  ].filter(Boolean).join(" · ");

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      url: `https://www.capivaraparlamentar.com.br/${casa}/${id}`,
      ...(parl.foto_url ? { images: [{ url: parl.foto_url, width: 300, height: 300, alt: parl.nome }] } : {}),
    },
    twitter: { card: "summary", title: titulo, description: descricao },
    alternates: { canonical: `https://www.capivaraparlamentar.com.br/${casa}/${id}` },
  };
}

export default async function ParlamentarLayout({ params, children }: LayoutProps) {
  const { casa, id } = await params;
  if (!(casa in CASAS) || !ID_RE.test(id)) notFound();

  const casaKey = casa as Casa;
  const { label, cargo } = CASAS[casaKey];

  const [parlamentar, orgaos] = await Promise.all([
    apiFetchOptional<Parlamentar>(`/parlamentares/${casa}/${id}`, 86400),
    apiFetch<ParlamentarOrgao[]>(`/parlamentares/${casa}/${id}/orgaos`, 86400),
  ]);

  if (!parlamentar) notFound();

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

          <div className="flex items-center gap-4 sm:contents">
            <AvatarFoto
              url={parlamentar.foto_url}
              iniciais={iniciais(parlamentar.nome)}
              size={110}
              rounded="rounded-2xl"
              fontSize={34}
            />

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

        </div>

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
                    key={o.id}
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
