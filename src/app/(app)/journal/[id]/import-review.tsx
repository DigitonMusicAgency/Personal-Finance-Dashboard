"use client";

import { useState, useEffect } from "react";
import type { Category } from "@/lib/types";
import type { ParsedTransaction } from "@/lib/parsers/wise-csv";
import { formatAmount, formatDateShort } from "@/lib/utils";
import { X, Loader2, Check, FileText } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "income", label: "Příjem" },
  { value: "expense", label: "Výdaj" },
  { value: "internal_transfer", label: "Převod" },
];

interface Props {
  journalId: string;
  accountId: string;
  importId: string;
  transactions: ParsedTransaction[];
  categories: Category[];
  fileName: string;
  onConfirmed: () => void;
  onCancelled: () => void;
}

interface EditableTransaction extends ParsedTransaction {
  _deleted: boolean;
}

export default function ImportReview({
  journalId,
  accountId,
  importId,
  transactions: initialTransactions,
  categories,
  fileName,
  onConfirmed,
  onCancelled,
}: Props) {
  const [rows, setRows] = useState<EditableTransaction[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  // Initialize rows with fee auto-categorization + categorization rules
  useEffect(() => {
    const bankFeeCat = categories.find(
      (c) =>
        c.name.toLowerCase().includes("bankovní poplatky") ||
        c.name.toLowerCase().includes("poplatky")
    );

    // Load categorization rules
    async function initRows() {
      let rules: Array<{ match_field: string; match_value: string; category_id: string }> = [];
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("categorization_rules")
          .select("match_field, match_value, category_id")
          .eq("journal_id", journalId);
        if (data) rules = data;
      } catch { /* ignore */ }

      // Also load default income category from localStorage
      let defaultIncomeCategoryId: string | null = null;
      try {
        defaultIncomeCategoryId = localStorage.getItem(`default-income-category-${journalId}`);
      } catch { /* ignore */ }

      const editableRows = initialTransactions.map((tx) => {
        let categoryId = tx._is_fee && bankFeeCat ? bankFeeCat.id : tx.category_id;

        // Apply categorization rules if no category set
        if (!categoryId) {
          for (const rule of rules) {
            const fieldValue = rule.match_field === "counterparty" ? tx.counterparty : tx.description;
            if (fieldValue && fieldValue.toLowerCase().includes(rule.match_value.toLowerCase())) {
              categoryId = rule.category_id;
              break;
            }
          }
        }

        // Apply default income category
        if (!categoryId && tx.type === "income" && defaultIncomeCategoryId) {
          categoryId = defaultIncomeCategoryId;
        }

        return { ...tx, category_id: categoryId, _deleted: false };
      });

      setRows(editableRows);
    }

    initRows();
  }, [initialTransactions, categories, journalId]);

  function updateRow(
    index: number,
    field: keyof EditableTransaction,
    value: unknown
  ) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function deleteRow(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, _deleted: true } : r))
    );
  }

  const activeRows = rows.filter((r) => !r._deleted);
  const activeCount = activeRows.length;

  async function handleConfirm() {
    if (activeCount === 0) return;

    setConfirming(true);
    setError("");

    try {
      // Fetch exchange rates for non-CZK transactions
      const enriched = await Promise.all(
        activeRows.map(async (tx) => {
          let amountCzk = tx.amount;
          let exchangeRate = 1.0;

          if (tx.currency !== "CZK") {
            try {
              const res = await fetch(
                `/api/exchange-rate?currency=${tx.currency}&date=${tx.date}`
              );
              if (res.ok) {
                const data = await res.json();
                exchangeRate = data.rate;
                amountCzk = tx.amount * exchangeRate;
              }
            } catch {
              // Keep amount as-is if rate fetch fails
              amountCzk = tx.amount;
            }
          }

          return {
            account_id: accountId,
            journal_id: journalId,
            date: tx.date,
            amount: tx.amount,
            currency: tx.currency,
            amount_czk: Math.round(amountCzk * 100) / 100,
            exchange_rate: exchangeRate,
            type: tx.type,
            description: tx.description || null,
            counterparty: tx.counterparty || null,
            category_id: tx.category_id || null,
            note: tx.note || null,
            source: tx.source,
            external_id: tx.external_id,
            original_amount: tx.original_amount,
            original_currency: tx.original_currency,
            document_import_id: importId,
          };
        })
      );

      // Send to confirm endpoint
      const res = await fetch("/api/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          import_id: importId,
          transactions: enriched,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Chyba při potvrzování importu");
        setConfirming(false);
        return;
      }

      onConfirmed();
    } catch {
      setError("Chyba při komunikaci se serverem");
      setConfirming(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await fetch("/api/imports/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_id: importId }),
      });
    } catch {
      // Proceed even if reject fails
    }
    onCancelled();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <h2 className="font-bold">Review importu — {fileName}</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Nalezeno transakcí: {activeCount}
                {activeCount !== rows.length && (
                  <span>
                    {" "}
                    (odstraněno: {rows.length - activeCount})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-6 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card)]">
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  #
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Datum
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Částka
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Měna
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Typ
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Protistrana
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Kategorie
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Popis
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                if (row._deleted) return null;

                const rowNum =
                  rows.slice(0, index + 1).filter((r) => !r._deleted).length;

                return (
                  <tr
                    key={index}
                    className={`border-b border-[var(--border)] ${
                      row._is_fee ? "bg-blue-500/5" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--muted-foreground)]">
                      {rowNum}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) =>
                          updateRow(index, "date", e.target.value)
                        }
                        className="w-32 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-[var(--primary)] focus:bg-[var(--input)]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          updateRow(
                            index,
                            "amount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className={`w-28 rounded border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-sm outline-none focus:border-[var(--primary)] focus:bg-[var(--input)] ${
                          row.amount >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--muted-foreground)]">
                      {row.currency}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.type}
                        onChange={(e) =>
                          updateRow(index, "type", e.target.value)
                        }
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-[var(--primary)] focus:bg-[var(--input)]"
                      >
                        {TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.counterparty}
                        onChange={(e) =>
                          updateRow(index, "counterparty", e.target.value)
                        }
                        className="w-full max-w-[180px] rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-[var(--primary)] focus:bg-[var(--input)]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.category_id || ""}
                        onChange={(e) =>
                          updateRow(
                            index,
                            "category_id",
                            e.target.value || null
                          )
                        }
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-[var(--primary)] focus:bg-[var(--input)]"
                      >
                        <option value="">Bez kategorie</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[var(--muted-foreground)]">
                      {row.description}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => deleteRow(index)}
                        className="rounded p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        title="Odstranit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-[var(--border)] bg-[var(--card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleCancel}
            disabled={confirming || cancelling}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
            Zrušit import
          </button>

          <button
            onClick={handleConfirm}
            disabled={confirming || cancelling || activeCount === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {confirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {confirming
              ? "Potvrzuji..."
              : `Potvrdit import (${activeCount} transakcí)`}
          </button>
        </div>
      </div>
    </div>
  );
}
