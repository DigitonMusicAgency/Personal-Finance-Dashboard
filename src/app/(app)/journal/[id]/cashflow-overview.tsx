"use client";

import { useMemo } from "react";
import { InboxIcon } from "lucide-react";
import { formatAmount, formatDateShort, getAmountColorClass } from "@/lib/utils";
import type { Journal, Transaction } from "@/lib/types";

interface Props {
  journal: Journal;
  transactions: Transaction[];
  onEditTransaction?: (tx: Transaction) => void;
}


const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  income: { label: "Příjem", color: "bg-emerald-500/20 text-emerald-400" },
  expense: { label: "Výdaj", color: "bg-red-500/20 text-red-400" },
  internal_transfer: { label: "Převod", color: "bg-zinc-500/20 text-zinc-400" },
  repayment: { label: "Splátka", color: "bg-pink-500/20 text-pink-400" },
  manual_adjustment: { label: "Úprava", color: "bg-purple-500/20 text-purple-400" },
};

export default function CashflowOverview({ journal, transactions, onEditTransaction }: Props) {
  const counterpartyLabel = journal.counterparty_name || "Protistrana";
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
      {/* Two-party balance */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="grid grid-cols-3 gap-4 items-center">
          {/* Left: You */}
          <div className="text-center">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Vy</p>
            <p className="text-sm font-medium">Vydáno protistraně</p>
            <p className="text-xl font-bold text-red-400 mt-1">
              {formatAmount(totalSpent)} Kč
            </p>
          </div>

          {/* Center: Net balance */}
          <div className="text-center">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Saldo</p>
            <p className={`text-3xl font-bold ${getAmountColorClass(remaining)}`}>
              {remaining > 0 ? "+" : ""}{formatAmount(remaining)} Kč
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              {remaining > 0
                ? `${counterpartyLabel} vám dluží`
                : remaining < 0
                  ? `Dlužíte – ${counterpartyLabel}`
                  : "Vyrovnáno"}
            </p>
          </div>

          {/* Right: Counterparty */}
          <div className="text-center">
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
              {counterpartyLabel}
            </p>
            <p className="text-sm font-medium">Přijato od protistrany</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">
              {formatAmount(totalReceived)} Kč
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 space-y-1">
          <div className="h-2 rounded-full bg-[var(--accent)]">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {progressPercent} % uhrazeno
          </p>
        </div>
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
                    onClick={() => onEditTransaction?.(tx as Transaction)}
                    className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--accent)] ${onEditTransaction ? "cursor-pointer" : ""}`}
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
