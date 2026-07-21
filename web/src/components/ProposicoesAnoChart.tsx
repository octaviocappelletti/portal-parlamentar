"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

export type AnoItem = { ano: number; total: number };

export default function ProposicoesAnoChart({ data }: { data: AnoItem[] }) {
  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="35%">
        <XAxis
          dataKey="ano"
          tick={{ fontSize: 12, fill: "#54606e", fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "#eef2f7" }}
          formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Proposições"]}
          labelStyle={{ color: "#1c2733", fontWeight: 700, fontSize: 13 }}
          contentStyle={{
            border: "1px solid #e4e9f0",
            borderRadius: 8,
            fontSize: 13,
            padding: "6px 12px",
          }}
        />
        <Bar dataKey="total" fill="#1351B4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
