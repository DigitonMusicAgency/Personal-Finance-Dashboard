"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Journal } from "@/lib/types";
import { Save, Archive, RotateCcw, Trash2 } from "lucide-react";

interface Props {
  journal: Journal;
}

export default function JournalSettings({ journal }: Props) {
  const router = useRouter();
  const [name, setName] = useState(journal.name);
  const [counterpartyName, setCounterpartyName] = useState(
    journal.counterparty_name ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);

    const { error } = await supabase
      .from("journals")
      .update({
        name: name.trim(),
        counterparty_name: counterpartyName.trim() || null,
      })
      .eq("id", journal.id);

    if (error) {
      alert("Chyba: " + error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleDelete() {
    const confirmText = prompt(
      `Pro smazání deníku "${journal.name}" napište jeho název:`
    );
    if (confirmText !== journal.name) {
      if (confirmText !== null) alert("Název nesouhlasí. Deník nebyl smazán.");
      return;
    }

    const { error } = await supabase
      .from("journals")
      .delete()
      .eq("id", journal.id);

    if (error) {
      alert("Chyba: " + error.message);
      return;
    }

    router.push("/");
  }

  async function handleArchiveToggle() {
    const action = journal.is_archived ? "obnovit" : "archivovat";
    if (!confirm(`Opravdu chcete ${action} tento deník?`)) return;

    const { error } = await supabase
      .from("journals")
      .update({ is_archived: !journal.is_archived })
      .eq("id", journal.id);

    if (error) {
      alert("Chyba: " + error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold">Nastavení deníku</h2>

      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Název deníku
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
            Typ deníku
          </label>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
            {journal.type === "cashflow"
              ? "Cashflow / pohledávkový deník"
              : "Standardní deník"}
            <span className="ml-2 text-xs">(nelze změnit)</span>
          </div>
        </div>

        {journal.type === "cashflow" && (
          <div>
            <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
              Protistrana (kdo dluží / komu dlužíte)
            </label>
            <input
              type="text"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              placeholder="např. Jan Novák"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saved ? "Uloženo!" : loading ? "Ukládám..." : "Uložit změny"}
        </button>
      </div>

      {/* Archive section */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="mb-2 font-medium">
          {journal.is_archived ? "Obnovení deníku" : "Archivace deníku"}
        </h3>
        <p className="mb-3 text-sm text-[var(--muted-foreground)]">
          {journal.is_archived
            ? "Tento deník je archivovaný. Obnovením se znovu zobrazí v postranním panelu."
            : "Archivací deník skryjete z postranního panelu. Data zůstanou zachována a deník můžete kdykoli obnovit."}
        </p>
        <button
          onClick={handleArchiveToggle}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${
            journal.is_archived
              ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
          }`}
        >
          {journal.is_archived ? (
            <>
              <RotateCcw className="h-4 w-4" />
              Obnovit deník
            </>
          ) : (
            <>
              <Archive className="h-4 w-4" />
              Archivovat deník
            </>
          )}
        </button>
      </div>

      {/* Delete section */}
      <div className="rounded-xl border border-red-500/30 bg-[var(--card)] p-4">
        <h3 className="mb-2 font-medium text-red-400">Smazat deník</h3>
        <p className="mb-3 text-sm text-[var(--muted-foreground)]">
          Trvale smaže deník a všechny jeho transakce, účty a kategorie. Tuto akci nelze vrátit zpět.
        </p>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4" />
          Smazat deník
        </button>
      </div>
    </div>
  );
}
