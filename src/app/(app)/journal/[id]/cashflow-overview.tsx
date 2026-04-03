"use client";

import { useMemo } from "react";
import { InboxIcon } from "lucide-react";
import { formatAmount, formatDateShort, getAmountColorClass } from "@/lib/utils";

interface Journal {
  id: string;
  user_id: string;
  name: string;
  type: "standard" | "cashflow";
  counterparty_name: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  amount_czk: number;
  type: string;
  description: string | null;
  counterparty: string | null;
}

interface Props {
  journal: Journal;
  transactions: Transaction[];
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  income: { label: "Příjem", color: "bg-emerald-500/20 text-emerald-400" },
  expense: { label: "Výdaj", color: "bg-red-500/20 text-red-400" },
  internal_transfer: { label: "Převod", color: "bg-zinc-500/20 text-zinc-400" },
  repayment: { label: "Splátka", color: "bg-pink-500/20 text-pink-400" },
  manual_adjustment: { label: "Úprava", color: "bg-purple-500/20 text-purple-400" },
};

export default function CashflowOverview({ journal, transactions }: Props) {
  const { totalReceived, totalSpent, remaining, progressPercent, sortedWithBalance } =
    useMemo(() => {
      // Card 1: sum of positive amount_czk (income + repayment)
      const received = transactions
        .filter((t) => t.type === "income" || t.type === "repayment")
        .reduce((sum, t) => sum + Math.abs(t.amount_czk), 0);

      // Card 2: sum of negative amount_czk (expense types) as absolute value
      const spent = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Math.abs(t.amount_czk), 0);

      // Card 3: remaining
      const rem = received - spent;

      // Progress: how much of total has been settled
      const total = received + spent;
      const progress = total > 0 ? Math.round((received / total) * 100) : 0;

      // Settlement history sorted by date ascending with running balance
      const sorted = [...transactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      let runningBalance = 0;
      const withBalance = sorted.map((tx) => {
        const signed =
          tx.type === "expense"
            ? -Math.abs(tx.amount_czk)
            : Math.abs(tx.amount_czk);
        runningBalance += signed;
        return { ...tx, balanceAfter: runningBalance };
      });

      return {
        totalReceived: received,
        totalSpent: spent,
        remaining: rem,
        progressPercent: progress,
        sortedWithBalance: withBalance,
      };
    }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Celkem přijato */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Celkem přijato
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">
            {formatAmount(totalReceived)} Kč
          </div>
        </div>

        {/* Celkem vydáno */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            Celkem vydáno
          </div>
          <div className="text-2xl font-bold mt-1 text-red-400">
            {formatAmount(totalSpent)} Kč
          </div>
        </div>

        {/* Zbývá */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                remaining > 0
                  ? "bg-emerald-400"
                  : remaining < 0
                    ? "bg-red-400"
                    : "bg-zinc-400"
              }`}
            />
            Zbývá
          </div>
          <div className={`text-2xl font-bold mt-1 ${getAmountColorClass(remaining)}`}>
            {formatAmount(remaining)} Kč
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-3 rounded-full bg-[var(--accent)]">
          <div
            className="h-3 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          {progressPercent} % uhrazeno
        </p>
      </div>

      {/* Settlement history table */}
      {sortedWithBalance.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <InboxIcon className="mx-auto h-12 w-12 text-[var(--muted-foreground)]" />
          <h3 className="mt-4 text-lg font-medium">Zatím žádné záznamy</h3>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Datum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Popis
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Typ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Částka
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Saldo po
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedWithBalance.map((tx) => {
                const typeInfo = TYPE_LABELS[tx.type] || {
                  label: tx.type,
                  color: "bg-zinc-500/20 text-zinc-400",
                };
                const displayAmount =
                  tx.type === "expense"
                    ? -Math.abs(tx.amount_czk)
                    : Math.abs(tx.amount_czk);

                return (
                  <tr
                    key={tx.id}
                    className="border-b border-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="max-w-[250px] truncate px-4 py-3 text-[var(--muted-foreground)]">
                      {tx.description || tx.counterparty || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.color}`}
                      >
                        {typeInfo.label}
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono ${getAmountColorClass(
                        displayAmount
                      )}`}
                    >
                      {displayAmount > 0 ? "+" : ""}
                      {formatAmount(displayAmount)} Kč
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono ${getAmountColorClass(
                        tx.balanceAfter
                      )}`}
                    >
                      {formatAmount(tx.balanceAfter)} Kč
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
