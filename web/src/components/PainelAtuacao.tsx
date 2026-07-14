const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  totalProposicoes: number;
  aprovadas: number;
  autorPrincipal: number;
  totalGasto: number;
  totalDespesas: number;
}

export default function PainelAtuacao({
  totalProposicoes,
  aprovadas,
  autorPrincipal,
  totalGasto,
  totalDespesas,
}: Props) {
  const taxaAprovacao = totalProposicoes > 0
    ? Math.round((aprovadas / totalProposicoes) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat
        label="Proposições"
        value={totalProposicoes.toLocaleString("pt-BR")}
        sub={`${autorPrincipal} como autor principal`}
      />
      <Stat
        label="Aprovadas"
        value={aprovadas.toLocaleString("pt-BR")}
        sub={`${taxaAprovacao}% do total`}
        highlight={aprovadas > 0}
      />
      <Stat
        label="Gasto CEAP"
        value={BRL.format(totalGasto)}
        sub={`${totalDespesas.toLocaleString("pt-BR")} lançamentos`}
      />
      <Stat
        label="Média por lançamento"
        value={totalDespesas > 0 ? BRL.format(totalGasto / totalDespesas) : "—"}
        sub="valor médio por despesa"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${highlight ? "text-green-600" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}
