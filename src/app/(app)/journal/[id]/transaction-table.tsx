"use client";

import { useState, useEffect, useCallback } from "react";
import type { Transaction, Account, Category, TransactionType } from "@/lib/types";
import { formatAmount, formatDateShort, getAmountColorClass } from "@/lib/utils";
import { Loader2, ArrowUpDown, InboxIcon } from "lucide-react";

const TYPE_LABELS: Record<TransactionType, { label: string; color: string }> = {
  income: { label: "Příjem", color: "bg-emerald-500/20 text-emerald-400" },
  expense: { label: "Výdaj", color: "bg-red-500/20 text-red-400" },
  internal_transfer: { label: "Převod", color: "bg-zinc-500/20 text-zinc-400" },
  repayment: { label: "Splátka", color: "bg-pink-500/20 text-pink-400" },
  manual_adjustment: { label: "Úprava", color: "bg-purple-500/20 text-purple-400" },
};

interface Props {
  journalId: string;
  accounts: Account[];
  categories: Category[];
  onEditTransaction: (transaction: Transaction) => void;
  refreshKey?: number;
}

export default function TransactionTable({
  journalId,
  accounts,
  categories,
  onEditTransaction,
  refreshKey,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  // Filters
  const [filterAccount, setFilterAccount] = useState("");
  const [filterType, setFilterType] = useState("");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ journal_id: journalId });
    if (filterAccount) params.set("account_id", filterAccount);
    if (filterType) params.set("type", filterType);

    try {
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [journalId, filterAccount, filterType]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, refreshKey]);

  // Sort transactions
  const sorted = [...transactions].sort((a, b) => {
    const cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    return sortAsc ? cmp : -cmp;
  });

  // Find category/account by ID for display
  function getCategoryName(catId: string | null) {
    if (!catId) return null;
    const cat = categories.find((c) => c.id === catId);
    return cat || null;
  }

  function getAccountName(accId: string) {
    const acc = accounts.find((a) => a.id === accId);
    return acc?.name || "—";
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="">Všechny účty</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="">Všechny typy</option>
          {Object.entries(TYPE_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {(filterAccount || filterType) && (
          <button
            onClick={() => {
              setFilterAccount("");
              setFilterType("");
            }}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Zrušit filtry
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <InboxIcon className="mx-auto h-12 w-12 text-[var(--muted-foreground)]" />
          <h3 className="mt-4 text-lg font-medium">Zatím žádné transakce</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Přidejte první transakci tlačítkem výše.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  <span className="flex items-center gap-1">
                    Datum
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Účet
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Částka
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  CZK
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Typ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Protistrana
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Kategorie
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Popis
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => {
                const typeInfo = TYPE_LABELS[tx.type as TransactionType] || {
                  label: tx.type,
                  color: "bg-zinc-500/20 text-zinc-400",
                };
                const cat = getCategoryName(tx.category_id);
                const displayAmount =
                  tx.type === "expense"
                    ? -Math.abs(tx.amount)
                    : tx.type === "income"
                    ? Math.abs(tx.amount)
                    : tx.amount;
                const displayAmountCzk =
                  tx.type === "expense"
                    ? -Math.abs(tx.amount_czk)
                    : tx.type === "income"
                    ? Math.abs(tx.amount_czk)
                    : tx.amount_czk;

                return (
                  <tr
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--muted-foreground)]">
                      {getAccountName(tx.account_id)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono ${getAmountColorClass(
                        displayAmount
                      )}`}
                    >
                      {displayAmount > 0 ? "+" : ""}
                      {formatAmount(displayAmount)} {tx.currency}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono ${getAmountColorClass(
                        displayAmountCzk
                      )}`}
                    >
                      {displayAmountCzk > 0 ? "+" : ""}
                      {formatAmount(displayAmountCzk)} Kč
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.color}`}
                      >
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="max-w-[150px] truncate px-4 py-3">
                      {tx.counterparty || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {cat ? (
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: cat.color || "#78716C" }}
                          />
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[var(--muted-foreground)]">
                      {tx.description || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction count */}
      {!loading && sorted.length > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Celkem {sorted.length} transakcí
        </p>
      )}
    </div>
  );
}
