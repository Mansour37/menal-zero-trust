"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";

interface DataPoint {
  time: string;
  total: number;
  errors: number;
}

export default function RequestsChart({ data }: { data: DataPoint[] }) {
  // Contournement d'un bug connu et ancien de Recharts : ResponsiveContainer
  // attache son ResizeObserver pendant l'hydratation Next.js et, sur cette
  // course precise, ne rend jamais .recharts-wrapper (issues recharts/recharts
  // #135, #854, #2831 — jamais corrige en amont). Retarder le montage du
  // graphique d'un tick client, une fois le DOM reellement stable, evite la
  // course sans dependre d'un correctif upstream.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="card-surface card-hero p-5 fade-up shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="label-overline mb-0.5">Trafic applicatif</p>
          <h3 className="text-[13.5px] font-bold text-[var(--ink)] tracking-tight">
            Requêtes — 20 dernières minutes d'activité
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--ink-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--chart-1)]" /> Total
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--sev-critical)]" /> Erreurs
          </span>
        </div>
      </div>

      {!mounted ? (
        <div className="h-[230px] animate-pulse rounded-lg bg-[var(--surface-2)]" />
      ) : (
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.45} />
              <stop offset="50%" stopColor="var(--chart-1)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradErrors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--sev-critical)" stopOpacity={0.45} />
              <stop offset="50%" stopColor="var(--sev-critical)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--sev-critical)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10.5, fill: "var(--ink-faint)" }}
            stroke="transparent"
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: "var(--ink-faint)" }}
            stroke="transparent"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                payload={payload}
                label={String(label)}
                labelFormatter={(l) => `Heure : ${l}`}
              />
            )}
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="var(--chart-1)"
            strokeWidth={2.2}
            fill="url(#gradTotal)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="errors"
            name="Erreurs"
            stroke="var(--sev-critical)"
            strokeWidth={2.2}
            fill="url(#gradErrors)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}