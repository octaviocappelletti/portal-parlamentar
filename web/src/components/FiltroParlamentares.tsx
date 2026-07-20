"use client";

import type { Casa, Parlamentar } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Props {
  parlamentares: Parlamentar[];
  casa: string;
  ufs: string[];
  partidos: string[];
}

const COR_CASA: Record<string, string> = {
  camara: "focus:ring-marinho-600",
  senado: "focus:ring-green-600",
};

const PAGE_SIZE = 60;

export default function FiltroParlamentares({ parlamentares, casa, ufs, partidos }: Props) {
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const [partido, setPartido] = useState("");
  const [visivel, setVisivel] = useState(PAGE_SIZE);

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return parlamentares.filter((p) => {
      if (termo && !p.nome.toLowerCase().includes(termo)) return false;
      if (uf && p.uf !== uf) return false;
      if (partido && p.partido !== partido) return false;
      return true;
    });
  }, [parlamentares, busca, uf, partido]);

  // Reinicia paginação ao mudar filtros
  useEffect(() => { setVisivel(PAGE_SIZE); }, [busca, uf, partido]);

  const exibidos = filtrados.slice(0, visivel);
  const limpo = !busca && !uf && !partido;

  return (
    <div>
      {/* Barra de filtros */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <label htmlFor="busca-parlamentar" className="sr-only">Buscar por nome</label>
        <input
          id="busca-parlamentar"
          type="search"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`input flex-1 min-w-[200px] ${COR_CASA[casa] ?? ""}`}
        />
        <label htmlFor="filtro-uf" className="sr-only">Filtrar por estado</label>
        <select
          id="filtro-uf"
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="input w-auto"
        >
          <option value="">Todos os estados</option>
          {ufs.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <label htmlFor="filtro-partido" className="sr-only">Filtrar por partido</label>
        <select
          id="filtro-partido"
          value={partido}
          onChange={(e) => setPartido(e.target.value)}
          className="input w-auto"
        >
          <option value="">Todos os partidos</option>
          {partidos.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {!limpo && (
          <button
            onClick={() => { setBusca(""); setUf(""); setPartido(""); }}
            className="btn-ghost text-slate-500"
          >
            Limpar
          </button>
        )}
        <span className="text-sm text-slate-500 ml-auto whitespace-nowrap">
          {filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          Nenhum parlamentar encontrado para os filtros selecionados.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
            {exibidos.map((p) => (
              <Link
                key={p.id}
                href={`/${casa}/${p.id_externo}`}
                className="card flex flex-col items-center p-4 hover:shadow-md hover:border-marinho-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marinho-600 transition group"
              >
                {p.foto_url ? (
                  <Image
                    src={p.foto_url}
                    alt={p.nome}
                    width={72}
                    height={72}
                    className="rounded-full object-cover mb-3 ring-2 ring-slate-100 group-hover:ring-marinho-100 transition"
                  />
                ) : (
                  <div className="w-[72px] h-[72px] rounded-full bg-slate-200 mb-3 flex items-center justify-center text-slate-500 text-xl font-bold">
                    {p.nome.charAt(0)}
                  </div>
                )}
                <span className="text-sm font-semibold text-center leading-tight text-slate-800 line-clamp-2">
                  {p.nome}
                </span>
                <span className="text-xs text-slate-500 mt-1.5 text-center">
                  {p.partido}
                </span>
                <span className="badge badge-gray mt-1">{p.uf}</span>
              </Link>
            ))}
          </div>

          {filtrados.length > visivel && (
            <div className="text-center mt-6">
              <button
                onClick={() => setVisivel((v) => v + PAGE_SIZE)}
                className="btn-ghost px-6 py-2 border border-slate-200"
              >
                Carregar mais ({filtrados.length - visivel} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
