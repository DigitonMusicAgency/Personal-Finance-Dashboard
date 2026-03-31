"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/lib/types";
import { formatAmount } from "@/lib/utils";
import { Plus, Pencil, X, Check, Building2, CheckCircle2 } from "lucide-react";

const CURRENCIES = ["CZK", "EUR", "USD", "GBP", "AUD", "PLN", "CHF"];
const BANKS = ["Air Bank", "Wise", "Fio", "ČSOB", "Komerční banka", "Raiffeisenbank", "Ostatní"];

interface Props {
  journalId: string;
  accounts: Account[];
  onAccountsChange: (accounts: Account[]) => void;
}

interface AccountFormData {
  name: string;
  bank_service: string;
  currency: string;
  opening_balance: string;
  opening_balance_date: string;
  note: string;
  is_own_account: boolean;
}

const emptyForm: AccountFormData = {
  name: "",
  bank_service: "Air Bank",
  currency: "CZK",
  opening_balance: "0",
  opening_balance_date: "",
  note: "",
  is_own_account: true,
};

export default function AccountManager({
  journalId,
  accounts,
  onAccountsChange,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  function updateForm(field: keyof AccountFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      bank_service: account.bank_service,
      currency: account.currency,
      opening_balance: String(account.opening_balance),
      opening_balance_date: account.opening_balance_date ?? "",
      note: account.note ?? "",
      is_own_account: account.is_own_account,
    });
    setShowForm(false);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.bank_service.trim()) return;
    setLoading(true);

    const payload = {
      journal_id: journalId,
      name: form.name.trim(),
      bank_service: form.bank_service,
      currency: form.currency,
      opening_balance: parseFloat(form.opening_balance) || 0,
      opening_balance_date: form.opening_balance_date || null,
      note: form.note.trim() || null,
      is_own_account: form.is_own_account,
    };

    let result;
    if (editingId) {
      result = await supabase
        .from("accounts")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
    } else {
      result = await supabase.from("accounts").insert(payload).select().single();
    }

    if (result.error) {
      alert("Chyba: " + result.error.message);
      setLoading(false);
      return;
    }

    // Update local state
    if (editingId) {
      onAccountsChange(
        accounts.map((a) => (a.id === editingId ? result.data : a))
      );
    } else {
      onAccountsChange([...accounts, result.data]);
    }

    cancelForm();
    setLoading(false);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Opravdu chcete deaktivovat tento účet?")) return;

    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      alert("Chyba: " + error.message);
      return;
    }

    onAccountsChange(accounts.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Účty</h2>
        {!showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            <Plus className="h-4 w-4" />
            Přidat účet
          </button>
        )}
      </div>

      {/* Account form */}
      {(showForm || editingId) && (
        <AccountForm
          form={form}
          updateForm={updateForm}
          onSave={handleSave}
          onCancel={cancelForm}
          loading={loading}
          isEditing={!!editingId}
        />
      )}

      {/* Account list */}
      {accounts.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-[var(--muted-foreground)]" />
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Zatím nemáte žádné účty. Přidejte svůj první bankovní účet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--muted-foreground)]/30"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{account.name}</h3>
                    <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
                      {account.currency}
                    </span>
                    {account.is_own_account && (
                      <span
                        className="flex items-center gap-0.5 text-xs text-emerald-400"
                        title="Vlastní účet"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Vlastní
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {account.bank_service}
                  </p>
                  {account.opening_balance !== 0 && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Počáteční zůstatek:{" "}
                      {formatAmount(account.opening_balance)} {account.currency}
                      {account.opening_balance_date &&
                        ` (${account.opening_balance_date})`}
                    </p>
                  )}
                  {account.note && (
                    <p className="text-sm text-[var(--muted-foreground)] italic">
                      {account.note}
                    </p>
                  )}
                </div>

                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(account)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Upravit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeactivate(account.id)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400"
                    title="Deaktivovat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountForm({
  form,
  updateForm,
  onSave,
  onCancel,
  loading,
  isEditing,
}: {
  form: AccountFormData;
  updateForm: (field: keyof AccountFormData, value: string | boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
  isEditing: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
      <h3 className="font-medium">
        {isEditing ? "Upravit účet" : "Nový účet"}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Název účtu *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateForm("name", e.target.value)}
            placeholder="např. Air Bank CZK"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Banka / služba *
          </label>
          <select
            value={form.bank_service}
            onChange={(e) => updateForm("bank_service", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            {BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Měna
          </label>
          <select
            value={form.currency}
            onChange={(e) => updateForm("currency", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Počáteční zůstatek
          </label>
          <input
            type="number"
            step="0.01"
            value={form.opening_balance}
            onChange={(e) => updateForm("opening_balance", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Datum počátečního zůstatku
          </label>
          <input
            type="date"
            value={form.opening_balance_date}
            onChange={(e) => updateForm("opening_balance_date", e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Poznámka
          </label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => updateForm("note", e.target.value)}
            placeholder="Volitelná poznámka"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_own_account}
          onChange={(e) => updateForm("is_own_account", e.target.checked)}
          className="rounded"
        />
        <span>
          Vlastní účet{" "}
          <span className="text-[var(--muted-foreground)]">
            (převody mezi vlastními účty se počítají jako interní převody)
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={loading || !form.name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Ukládám..." : isEditing ? "Uložit změny" : "Přidat účet"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}
