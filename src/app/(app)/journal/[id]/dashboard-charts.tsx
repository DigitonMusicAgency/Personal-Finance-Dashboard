"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { formatAmount } from "@/lib/utils";
import type { Transaction, Category } from "@/lib/types";

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

const CZECH_MONTHS = [
  "Led", "Úno", "Bře", "Dub", "Kvě", "Čvn",
  "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro",
];

const AXIS_COLOR = "#71717A";
const GRID_COLOR = "#27272A";
const TOOLTIP_BG = "#18181B";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: TOOLTIP_BG }}
    >
      {label && (
        <p className="mb-1 font-medium text-[var(--foreground)]">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatAmount(entry.value)} Kč
        </p>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { fill: string };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div
      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs shadow-lg"
      style={{ backgroundColor: TOOLTIP_BG }}
    >
      <p style={{ color: entry.payload.fill }}>
        {entry.name}: {formatAmount(entry.value)} Kč
      </p>
    </div>
  );
}

export default function DashboardCharts({ transactions, categories }: Props) {
  // --- Bar Chart Data: Income vs Expenses by Month ---
  const barData = useMemo(() => {
    const monthMap = new Map<string, { income: number; expenses: number }>();
    for (const t of transactions) {
      const key = t.date.slice(0, 7); // YYYY-MM
      const entry = monthMap.get(key) ?? { income: 0, expenses: 0 };
      if (t.type === "income") {
        entry.income += t.amount_czk;
      } else if (t.type === "expense") {
        entry.expenses += Math.abs(t.amount_czk);
      }
      monthMap.set(key, entry);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const monthIndex = parseInt(key.slice(5, 7), 10) - 1;
        return {
          month: CZECH_MONTHS[monthIndex] ?? key,
          Příjmy: Math.round(val.income),
          Výdaje: Math.round(val.expenses),
        };
      });
  }, [transactions]);

  // --- Pie Chart Data: Expenses by Category ---
  const pieData = useMemo(() => {
    const catMap = new Map<string | null, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const key = t.category_id;
      catMap.set(key, (catMap.get(key) ?? 0) + Math.abs(t.amount_czk));
    }
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    return Array.from(catMap.entries()).map(([catId, total]) => {
      const cat = catId ? categoryById.get(catId) : null;
      return {
        name: cat?.name ?? "Bez kategorie",
        value: Math.round(total),
        color: cat?.color ?? "#78716C",
      };
    });
  }, [transactions, categories]);

  // --- Line Chart Data: Cumulative Balance ---
  const lineData = useMemo(() => {
    const sorted = [...transactions]
      .filter((t) => t.type !== "internal_transfer")
      .sort((a, b) => a.date.localeCompare(b.date));

    let cumulative = 0;
    return sorted.map((t) => {
      cumulative += t.amount_czk;
      return {
        date: t.date,
        Saldo: Math.round(cumulative),
      };
    });
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
        Zatím žádná data pro grafy
      </div>
    );
  }

  const cardClass = "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4";
  const titleClass = "text-sm font-medium text-[var(--muted-foreground)] mb-4";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart — Income vs Expenses */}
      <div className={cardClass}>
        <h3 className={titleClass}>Příjmy vs Výdaje</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis
              dataKey="month"
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
            />
            <YAxis
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
              tickFormatter={(v: number) => formatAmount(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }}
            />
            <Bar dataKey="Příjmy" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Výdaje" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie/Donut Chart — Expenses by Category */}
      <div className={cardClass}>
        <h3 className={titleClass}>Výdaje dle kategorií</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
            >
              {pieData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Line/Area Chart — Cumulative Balance (full width) */}
      <div className={`${cardClass} lg:col-span-2`}>
        <h3 className={titleClass}>Vývoj salda</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis
              dataKey="date"
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
            />
            <YAxis
              tick={{ fill: AXIS_COLOR, fontSize: 12 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
              tickFormatter={(v: number) => formatAmount(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="Saldo"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
