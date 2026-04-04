"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Transaction, Account, Category, TransactionType } from "@/lib/types";
import { formatAmount, formatDateShort, getAmountColorClass } from "@/lib/utils";
import { Loader2, ArrowUpDown, InboxIcon, Search } from "lucide-react";

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
  startDate?: string;
  endDate?: string;
}

export default function TransactionTable({
  journalId,
  accounts,
  categories,
  onEditTransaction,
  refreshKey,
  startDate,
  endDate,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  // Filters
  const [filterAccount, setFilterAccount] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchText, setSearchText] = useState("");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ journal_id: journalId, limit: "5000" });
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

  // Scroll position preservation
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);

  function handleEdit(tx: Transaction) {
    // Save scroll position before opening form
    const scrollParent = scrollRef.current?.closest(".overflow-y-auto");
    if (scrollParent) savedScrollTop.current = scrollParent.scrollTop;
    onEditTransaction(tx);
  }

  // Restore scroll position after refresh (edit save)
  useEffect(() => {
    if (savedScrollTop.current > 0 && !loading) {
      const scrollParent = scrollRef.current?.closest(".overflow-y-auto");
      if (scrollParent) {
        // Wait for DOM to fully render before restoring scroll
        const target = savedScrollTop.current;
        setTimeout(() => {
          scrollParent.scrollTop = target;
        }, 50);
      }
    }
  }, [loading, refreshKey]);

  // Filter by date range, category, search text, then sort
  let dateFiltered = transactions;
  if (startDate && endDate) {
    dateFiltered = transactions.filter(
      (tx) => tx.date >= startDate && tx.date <= endDate
    );
  }

  let catFiltered = dateFiltered;
  if (filterCategory === "__none__") {
    catFiltered = dateFiltered.filter((tx) => !tx.category_id);
  } else if (filterCategory) {
    catFiltered = dateFiltered.filter((tx) => tx.category_id === filterCategory);
  }

  const filtered = searchText.trim()
    ? catFiltered.filter((tx) => {
        const q = searchText.toLowerCase();
        return (
          (tx.counterparty || "").toLowerCase().includes(q) ||
          (tx.description || "").toLowerCase().includes(q) ||
          (tx.note || "").toLowerCase().includes(q)
        );
      })
    : catFiltered;

  const sorted = [...filtered].sort((a, b) => {
    const cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    return sortAsc ? cmp : -cmp;
  });

  // Find category/account by ID for display
  function getCategoryName(catId: string | null) {
    if (!catId) return null;
    const cat = categories.find((c) => c.id === catId);
    return cat || null;
  }

  function getAccountName(accId: string | null) {
    if (!accId) return "—";
    const acc = accounts.find((a) => a.id === accId);
    return acc?.name || "—";
  }

  return (
    <div className="space-y-4" ref={scrollRef}>
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

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="">Všechny kategorie</option>
          <option value="__none__">Bez kategorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Hledat v transakcích..."
            className="rounded-lg border border-[var(--border)] bg-[var(--input)] pl-8 pr-3 py-1.5 text-sm outline-none focus:border-[var(--primary)] w-56"
          />
        </div>

        {(filterAccount || filterType || filterCategory || searchText) && (
          <button
            onClick={() => {
              setFilterAccount("");
              setFilterType("");
              setFilterCategory("");
              setSearchText("");
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
                    onClick={() => handleEdit(tx)}
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
