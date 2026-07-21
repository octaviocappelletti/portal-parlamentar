"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export type MesItem = { mes: number; total: number };

export default function GastosMensaisChart({ data }: { data: MesItem[] }) {
  const chartData = MESES.map((label, i) => {
    const found = data.find((d) => d.mes === i + 1);
    return { label, total: found?.total ?? 0 };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#54606e", fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis hide />
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
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill="#1351B4" opacity={d.total > 0 ? 1 : 0.15} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
