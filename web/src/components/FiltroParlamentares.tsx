"use client";

import type { Casa, Parlamentar } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

interface Props {
  parlamentares: Parlamentar[];
  casa: string;
  ufs: string[];
  partidos: string[];
}

const COR_CASA: Record<string, string> = {
  camara: "focus:ring-blue-500",
  senado: "focus:ring-emerald-500",
};

export default function FiltroParlamentares({ parlamentares, casa, ufs, partidos }: Props) {
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const [partido, setPartido] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return parlamentares.filter((p) => {
      if (termo && !p.nome.toLowerCase().includes(termo)) return false;
      if (uf && p.uf !== uf) return false;
      if (partido && p.partido !== partido) return false;
      return true;
    });
  }, [parlamentares, busca, uf, partido]);

  const limpo = !busca && !uf && !partido;

  return (
    <div>
      {/* Barra de filtros */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`input flex-1 min-w-[200px] ${COR_CASA[casa] ?? ""}`}
        />
        <select
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="input w-auto"
        >
          <option value="">Todos os estados</option>
          {ufs.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select
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
            className="btn-ghost text-slate-400"
          >
            Limpar
          </button>
        )}
        <span className="text-sm text-slate-400 ml-auto whitespace-nowrap">
          {filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          Nenhum parlamentar encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtrados.map((p) => (
            <Link
              key={p.id}
              href={`/${casa}/${p.id_externo}`}
              className="card flex flex-col items-center p-4 hover:shadow-md hover:border-slate-300 transition-all group"
            >
              {p.foto_url ? (
                <Image
                  src={p.foto_url}
                  alt={p.nome}
                  width={72}
                  height={72}
                  className="rounded-full object-cover mb-3 ring-2 ring-slate-100 group-hover:ring-blue-100 transition-all"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-full bg-slate-200 mb-3 flex items-center justify-center text-slate-400 text-xl font-bold">
                  {p.nome.charAt(0)}
                </div>
              )}
              <span className="text-sm font-semibold text-center leading-tight text-slate-800 line-clamp-2">
                {p.nome}
              </span>
              <span className="text-xs text-slate-400 mt-1.5 text-center">
                {p.partido}
              </span>
              <span className="badge badge-gray mt-1">{p.uf}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
