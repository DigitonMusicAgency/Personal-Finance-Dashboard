"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  Journal,
  Account,
  Category,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { formatAmount } from "@/lib/utils";
import { X, Loader2, Trash2 } from "lucide-react";

const CURRENCIES = ["CZK", "EUR", "USD", "GBP", "AUD", "PLN", "CHF"];

const TYPE_OPTIONS: { value: TransactionType; label: string; cashflowLabel?: string; cashflowOnly?: boolean; standardOnly?: boolean }[] = [
  { value: "income", label: "Příjem", cashflowLabel: "__B__ → __A__" },
  { value: "expense", label: "Výdaj", cashflowLabel: "__A__ → __B__" },
  { value: "internal_transfer", label: "Interní převod", standardOnly: true },
  { value: "repayment", label: "Splátka", cashflowOnly: true, cashflowLabel: "Splátka" },
  { value: "manual_adjustment", label: "Ruční úprava", cashflowOnly: true, cashflowLabel: "Ruční úprava" },
];

interface Props {
  journal: Journal;
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction | null;
  onClose: () => void;
  onSaved: (transaction: Transaction) => void;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function TransactionForm({
  journal,
  accounts,
  categories,
  transaction,
  onClose,
  onSaved,
}: Props) {
  const isEditing = !!transaction;

  // Form state
  const [date, setDate] = useState(transaction?.date || todayStr());
  const [accountId, setAccountId] = useState(
    transaction?.account_id || accounts[0]?.id || ""
  );
  const [type, setType] = useState<TransactionType>(
    (transaction?.type as TransactionType) || "expense"
  );
  const [amount, setAmount] = useState(
    transaction ? String(Math.abs(transaction.amount)) : ""
  );
  const [currency, setCurrency] = useState(
    transaction?.currency || accounts[0]?.currency || "CZK"
  );
  const [exchangeRate, setExchangeRate] = useState(
    transaction ? String(transaction.exchange_rate) : "1"
  );
  const [rateManual, setRateManual] = useState(false);
  const [counterparty, setCounterparty] = useState(
    transaction?.counterparty || ""
  );
  const [description, setDescription] = useState(
    transaction?.description || ""
  );
  const [categoryId, setCategoryId] = useState(
    transaction?.category_id || ""
  );
  const [note, setNote] = useState(transaction?.note || "");

  const [loadingRate, setLoadingRate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Derived values
  const parsedAmount = parseFloat(amount) || 0;
  const parsedRate = parseFloat(exchangeRate) || 1;
  const amountCzk = parsedAmount * parsedRate;
  const isCzk = currency === "CZK";
  const isCashflow = journal.type === "cashflow";

  // When account changes, update currency
  const handleAccountChange = (accId: string) => {
    setAccountId(accId);
    const acc = accounts.find((a) => a.id === accId);
    if (acc) {
      setCurrency(acc.currency);
    }
  };

  // Fetch exchange rate when currency or date changes
  const fetchRate = useCallback(async () => {
    if (isCzk || rateManual) {
      if (isCzk) setExchangeRate("1");
      return;
    }

    setLoadingRate(true);
    try {
      const res = await fetch(
        `/api/exchange-rate?currency=${currency}&date=${date}`
      );
      if (res.ok) {
        const data = await res.json();
        setExchangeRate(String(data.rate));
      }
    } catch {
      // Keep existing rate if fetch fails
    } finally {
      setLoadingRate(false);
    }
  }, [currency, date, isCzk, rateManual]);

  useEffect(() => {
    if (!isEditing) {
      fetchRate();
    }
  }, [fetchRate, isEditing]);

  // Available types based on journal type
  const ownerLabel = journal.owner_name || "Strana A";
  const counterpartyLabel = journal.counterparty_name || "Strana B";

  const availableTypes = TYPE_OPTIONS
    .filter((t) => {
      if (isCashflow) return !t.standardOnly;
      return !t.cashflowOnly;
    })
    .map((t) => {
      if (isCashflow && t.cashflowLabel) {
        return {
          ...t,
          label: t.cashflowLabel
            .replace("__A__", ownerLabel)
            .replace("__B__", counterpartyLabel),
        };
      }
      return t;
    });

  async function handleSave() {
    if (!amount || !date) {
      setError("Vyplňte datum a částku.");
      return;
    }

    setSaving(true);
    setError("");

    // Determine signed amount based on type
    const signedAmount =
      type === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
    const signedAmountCzk =
      type === "expense" ? -Math.abs(amountCzk) : Math.abs(amountCzk);

    const payload = {
      account_id: accountId || null,
      journal_id: journal.id,
      date,
      amount: signedAmount,
      currency,
      amount_czk: Math.round(signedAmountCzk * 100) / 100,
      exchange_rate: parsedRate,
      type,
      description: description.trim() || null,
      counterparty: counterparty.trim() || null,
      category_id: categoryId || null,
      note: note.trim() || null,
      source: "manual" as const,
    };

    try {
      let res: Response;
      if (isEditing) {
        res = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transaction.id, ...payload }),
        });
      } else {
        res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Chyba při ukládání transakce");
        setSaving(false);
        return;
      }

      onSaved(data);
    } catch {
      setError("Chyba při komunikaci se serverem");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!transaction) return;
    if (!confirm("Opravdu chcete smazat tuto transakci?")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/transactions?id=${transaction.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onSaved(transaction); // trigger refresh
      } else {
        const data = await res.json();
        setError(data.error || "Chyba při mazání");
      }
    } catch {
      setError("Chyba při komunikaci se serverem");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {isEditing ? "Upravit transakci" : "Nová transakce"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Row 1: Date + Account */}
          <div className={`grid gap-4 ${accounts.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                Datum *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
            {accounts.length > 0 && (
              <div>
                <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                  Účet
                </label>
                <select
                  value={accountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                >
                  <option value="">Bez účtu</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Row 2: Type */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
              Typ *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            >
              {availableTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Row 3: Amount + Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                Částka *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                Měna
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Exchange rate (only for non-CZK) */}
          {!isCzk && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--muted-foreground)]">
                  Kurz {currency}/CZK
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={rateManual}
                    onChange={(e) => setRateManual(e.target.checked)}
                    className="rounded"
                  />
                  Ruční kurz
                </label>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  step="0.000001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  disabled={!rateManual && loadingRate}
                  className="w-32 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] disabled:opacity-50"
                />
                {loadingRate && (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                )}
                {!rateManual && !loadingRate && (
                  <button
                    onClick={fetchRate}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    Obnovit kurz
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm">
                <span className="text-[var(--muted-foreground)]">
                  Částka v CZK:{" "}
                </span>
                <span className="font-medium">
                  {formatAmount(amountCzk)} Kč
                </span>
              </p>
            </div>
          )}

          {/* Row 5: Counterparty */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
              Protistrana
            </label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="např. Albert, Klient X"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Row 6: Description */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
              Popis
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Volitelný popis"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Row 7: Category (hidden for cashflow journals) */}
          {!isCashflow && (
            <div>
              <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                Kategorie
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                <option value="">Bez kategorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Row 8: Note */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
              Poznámka
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Volitelná poznámka"
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>

          {/* Source info for edit mode */}
          {isEditing && transaction && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Zdroj:{" "}
              {transaction.source === "manual"
                ? "Ruční zadání"
                : transaction.source === "import_csv"
                ? "Import CSV"
                : transaction.source === "import_pdf"
                ? "Import PDF"
                : transaction.source}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Mažu..." : "Smazat"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            >
              Zrušit
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !amount}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Ukládám..." : "Uložit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
