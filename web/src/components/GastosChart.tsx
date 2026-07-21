const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export type GastoItem = { label: string; total: number; cor: string };

export default function GastosChart({ data }: { data: GastoItem[] }) {
  if (!data.length) return null;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex flex-col gap-2 max-w-[460px]">
      {data.map((item, i) => {
        const pct = Math.round((item.total / maxTotal) * 100);
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[11px] text-text-body font-semibold truncate mr-3"
                title={item.label}
              >
                {item.label}
              </span>
              <span className="font-extrabold text-[18px] text-brand-blue-dark shrink-0">
                {BRL.format(item.total)}
              </span>
            </div>
            <div className="h-[5px] bg-track rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: item.cor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
