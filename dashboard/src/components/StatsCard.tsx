import clsx from "clsx";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "blue" | "red" | "orange" | "green";
}

const colorMap = {
  blue:   "bg-blue-50 border-blue-200 text-blue-700",
  red:    "bg-red-50  border-red-200  text-red-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
  green:  "bg-green-50 border-green-200 text-green-700",
};

export default function StatsCard({ title, value, subtitle, color = "blue" }: Props) {
  return (
    <div className={clsx("rounded-xl border p-5", colorMap[color])}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  );
}
