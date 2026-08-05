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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Requêtes — 20 dernières minutes d&apos;activité</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone" dataKey="total" stroke="#1a56db"
            strokeWidth={2} dot={false} name="Total"
          />
          <Line
            type="monotone" dataKey="errors" stroke="#e02424"
            strokeWidth={2} dot={false} name="Erreurs"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
