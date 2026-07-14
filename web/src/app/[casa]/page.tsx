import { supabase } from "@/lib/db";
import FiltroParlamentares from "@/components/FiltroParlamentares";
import type { Parlamentar } from "@/types";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 86400;

const LABELS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
};

interface Props {
  params: Promise<{ casa: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { casa } = await params;
  return { title: LABELS[casa] ?? "Parlamentares" };
}

export default async function ListaPage({ params }: Props) {
  const { casa } = await params;
  if (!LABELS[casa]) notFound();

  const { data: parlamentares, error } = await supabase
    .from("parlamentar")
    .select("*")
    .eq("casa", casa)
    .order("nome");

  if (error) throw error;

  if (!parlamentares?.length) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-4">{LABELS[casa]}</h1>
        <p className="text-slate-500">
          Nenhum parlamentar encontrado. Execute a ingestão primeiro.
        </p>
      </main>
    );
  }

  const ufs = [...new Set((parlamentares as Parlamentar[]).map((p) => p.uf).filter(Boolean))].sort() as string[];
  const partidos = [...new Set((parlamentares as Parlamentar[]).map((p) => p.partido).filter(Boolean))].sort() as string[];

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{LABELS[casa]}</h1>
        <p className="text-sm text-slate-400 mt-1">{parlamentares.length} parlamentares</p>
      </div>
      <FiltroParlamentares
        parlamentares={parlamentares as Parlamentar[]}
        casa={casa}
        ufs={ufs}
        partidos={partidos}
      />
    </main>
  );
}
