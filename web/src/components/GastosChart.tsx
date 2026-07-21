"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export type GastoItem = { label: string; total: number; cor: string };

export default function GastosChart({ data }: { data: GastoItem[] }) {
  if (!data.length) return null;

  const height = Math.max(data.length * 48, 120);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="30%"
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={185}
          tick={{ fontSize: 13, fill: "#54606e", fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "#eef2f7" }}
          formatter={(value) => [BRL.format(Number(value)), "Total"]}
          labelStyle={{ color: "#1c2733", fontWeight: 700, fontSize: 13 }}
          contentStyle={{
            border: "1px solid #e4e9f0",
            borderRadius: 8,
            fontSize: 13,
            padding: "6px 12px",
          }}
        />
        <Bar
          dataKey="total"
          radius={[0, 4, 4, 0]}
          background={{ fill: "#eef2f7", radius: 4 } as object}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.cor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
