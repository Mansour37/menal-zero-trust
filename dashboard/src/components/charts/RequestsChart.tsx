"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface DataPoint {
  time: string;
  total: number;
  errors: number;
}

export default function RequestsChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--ink)] mb-4">Requêtes — 20 dernières minutes d&apos;activité</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} stroke="var(--border)" />
          <YAxis tick={{ fontSize: 11, fill: "var(--ink-faint)" }} stroke="var(--border)" />
          <Tooltip
            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--ink)" }}
            itemStyle={{ color: "var(--ink-muted)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-muted)" }} />
          <Line
            type="monotone" dataKey="total" stroke="var(--accent)"
            strokeWidth={2} dot={false} name="Total"
          />
          <Line
            type="monotone" dataKey="errors" stroke="var(--sev-critical)"
            strokeWidth={2} dot={false} name="Erreurs"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
