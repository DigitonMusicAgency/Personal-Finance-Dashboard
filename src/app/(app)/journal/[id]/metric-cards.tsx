"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatAmount, formatPercentChange, getAmountColorClass } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

interface Props {
  transactions: Transaction[];
  previousTransactions: Transaction[];
}

function calcIncome(txs: Transaction[]): number {
  return txs
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount_czk, 0);
}

function calcExpenses(txs: Transaction[]): number {
  return txs
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount_czk), 0);
}

export function MetricCards({ transactions, previousTransactions }: Props) {
  const { income, expenses, saldo, changePercent } = useMemo(() => {
    const inc = calcIncome(transactions);
    const exp = calcExpenses(transactions);
    const sal = inc - exp;

    const prevInc = calcIncome(previousTransactions);
    const prevExp = calcExpenses(previousTransactions);
    const prevSal = prevInc - prevExp;

    let change: number | null = null;
    if (prevSal !== 0) {
      change = ((sal - prevSal) / Math.abs(prevSal)) * 100;
    } else if (sal !== 0) {
      change = sal > 0 ? 100 : -100;
    }

    return { income: inc, expenses: exp, saldo: sal, changePercent: change };
  }, [transactions, previousTransactions]);

  const ChangeIcon =
    changePercent === null || changePercent === 0
      ? Minus
      : changePercent > 0
        ? TrendingUp
        : TrendingDown;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Prijmy (Income) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Příjmy
        </div>
        <div className="text-2xl font-bold mt-1 text-emerald-400">
          {formatAmount(income)} Kč
        </div>
      </div>

      {/* Vydaje (Expenses) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          Výdaje
        </div>
        <div className="text-2xl font-bold mt-1 text-red-400">
          {formatAmount(expenses)} Kč
        </div>
      </div>

      {/* Saldo (Balance) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              saldo > 0
                ? "bg-emerald-400"
                : saldo < 0
                  ? "bg-red-400"
                  : "bg-zinc-400"
            }`}
          />
          Saldo
        </div>
        <div className={`text-2xl font-bold mt-1 ${getAmountColorClass(saldo)}`}>
          {formatAmount(saldo)} Kč
        </div>
      </div>

      {/* Zmena (Change vs previous period) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              changePercent === null || changePercent === 0
                ? "bg-zinc-400"
                : changePercent > 0
                  ? "bg-emerald-400"
                  : "bg-red-400"
            }`}
          />
          Změna
        </div>
        <div className="flex items-center gap-1.5 text-2xl font-bold mt-1">
          <ChangeIcon
            className={`h-5 w-5 ${
              changePercent === null || changePercent === 0
                ? "text-zinc-400"
                : changePercent > 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }`}
          />
          <span
            className={
              changePercent === null || changePercent === 0
                ? "text-zinc-400"
                : changePercent > 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }
          >
            {changePercent !== null ? formatPercentChange(changePercent) : "—"}
          </span>
        </div>
        <div className="text-sm mt-1 text-[var(--muted-foreground)]">
          oproti minulému období
        </div>
      </div>
    </div>
  );
}
