import { supabase } from "@/lib/db";
import type { Parlamentar } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 86400;

const LABELS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
};

interface Props {
  params: Promise<{ casa: string }>;
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
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-4">{LABELS[casa]}</h1>
        <p className="text-gray-500">
          Nenhum parlamentar encontrado. Execute a ingestão primeiro.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">{LABELS[casa]}</h1>
      <p className="text-sm text-gray-400 mb-6">{parlamentares.length} parlamentares</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {parlamentares.map((p: Parlamentar) => (
          <Link
            key={p.id}
            href={`/${casa}/${p.id_externo}`}
            className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {p.foto_url ? (
              <Image
                src={p.foto_url}
                alt={p.nome}
                width={72}
                height={72}
                className="rounded-full object-cover mb-2"
              />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full bg-gray-200 mb-2" />
            )}
            <span className="text-sm font-medium text-center leading-tight">{p.nome}</span>
            <span className="text-xs text-gray-400 mt-1">
              {p.partido} · {p.uf}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
