const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  totalProposicoes: number;
  aprovadas: number;
  totalGasto: number;
}

export default function PainelAtuacao({ totalProposicoes, aprovadas, totalGasto }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Stat label="Proposições" value={String(totalProposicoes)} />
      <Stat label="Aprovadas" value={String(aprovadas)} highlight={aprovadas > 0} />
      <Stat label="Gasto CEAP" value={BRL.format(totalGasto)} />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-green-600" : ""}`}>{value}</p>
    </div>
  );
}
