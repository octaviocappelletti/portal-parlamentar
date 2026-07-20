import Link from "next/link";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  casa: string;
  parlamentarId: number;
  totalProposicoes: number;
  primeiroAutor: number;
  aprovadas: number;
  aprovadasPrimeiroAutor: number;
  totalGasto: number;
  totalDespesas: number;
}

export default function PainelAtuacao({
  casa,
  parlamentarId,
  totalProposicoes,
  primeiroAutor,
  aprovadas,
  aprovadasPrimeiroAutor,
  totalGasto,
  totalDespesas,
}: Props) {
  const base = `/${casa}/${parlamentarId}`;
  const pct = (n: number) =>
    totalProposicoes > 0 ? `${Math.round((n / totalProposicoes) * 100)}% do total` : "0% do total";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      <Stat
        href={`${base}?aba=projetos`}
        label="Proposições"
        value={totalProposicoes.toLocaleString("pt-BR")}
        sub="total apresentadas"
      />
      {casa !== "senado" && (
        <Stat
          href={`${base}?aba=projetos&filtro=primeiro-autor`}
          label="Como 1º autor"
          value={primeiroAutor.toLocaleString("pt-BR")}
          sub={pct(primeiroAutor)}
        />
      )}
      <Stat
        href={`${base}?aba=projetos&filtro=aprovadas`}
        label="Aprovadas"
        value={aprovadas.toLocaleString("pt-BR")}
        sub={pct(aprovadas)}
        highlight={aprovadas > 0}
      />
      {casa !== "senado" && (
        <Stat
          href={`${base}?aba=projetos&filtro=aprovadas-primeiro-autor`}
          label="Aprovadas (1º autor)"
          value={aprovadasPrimeiroAutor.toLocaleString("pt-BR")}
          sub="de autoria própria"
          highlight={aprovadasPrimeiroAutor > 0}
        />
      )}
      <Stat
        href={`${base}?aba=despesas`}
        label="Gasto CEAP"
        value={BRL.format(totalGasto)}
        sub={`${totalDespesas.toLocaleString("pt-BR")} lançamentos`}
      />
      <Stat
        href={`${base}?aba=despesas`}
        label="Média por despesa"
        value={totalDespesas > 0 ? BRL.format(totalGasto / totalDespesas) : "—"}
        sub="valor médio"
      />
    </div>
  );
}

function Stat({
  href,
  label,
  value,
  sub,
  highlight,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card p-4 hover:shadow-md hover:border-marinho-200 transition block group"
    >
      <p className="section-label mb-1 group-hover:text-slate-800 transition-colors">
        {label}
      </p>
      <p
        className={`text-2xl font-bold leading-tight break-all ${
          highlight ? "text-green-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </Link>
  );
}
