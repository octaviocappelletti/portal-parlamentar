import type { Casa, Despesa } from "@/types";
import Link from "next/link";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  despesas: Despesa[];
  casa: Casa;
  parlamentarId: number;
}

export default function TabelaCotas({ despesas, casa, parlamentarId }: Props) {
  // Agrupa por mês/ano para exibir subtotais
  const agrupado: Record<string, { total: number; itens: Despesa[] }> = {};
  for (const d of despesas) {
    const chave = `${d.ano}-${String(d.mes).padStart(2, "0")}`;
    if (!agrupado[chave]) agrupado[chave] = { total: 0, itens: [] };
    agrupado[chave].total += d.valor_liquido ?? 0;
    agrupado[chave].itens.push(d);
  }

  return (
    <div className="divide-y border rounded-lg overflow-hidden">
      {Object.entries(agrupado)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([chave, { total, itens }]) => {
          const [ano, mesStr] = chave.split("-");
          const mes = parseInt(mesStr, 10);
          return (
            <details key={chave} className="group">
              <summary className="flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-gray-50 list-none">
                <span className="text-sm font-medium">
                  {MESES[mes]}/{ano}
                </span>
                <span className="text-sm text-gray-600 font-mono">{BRL.format(total)}</span>
              </summary>
              <div className="bg-gray-50 divide-y">
                {itens.map((d) => (
                  <Link
                    key={d.id}
                    href={`/${casa}/${parlamentarId}/despesas/${d.id}`}
                    className="flex items-center gap-4 px-6 py-2 hover:bg-gray-100 transition-colors"
                  >
                    <span className="flex-1 text-xs text-gray-600 truncate">{d.natureza}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[160px]">{d.fornecedor}</span>
                    <span className="text-xs font-mono text-gray-700 flex-shrink-0">
                      {BRL.format(d.valor_liquido ?? 0)}
                    </span>
                  </Link>
                ))}
              </div>
            </details>
          );
        })}
    </div>
  );
}
