"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JournalType } from "@/lib/types";
import { BookOpen } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<JournalType>("standard");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert("Chyba při vytváření deníku: " + (data.error || "Neznámá chyba"));
        setLoading(false);
        return;
      }

      router.push(`/journal/${data.id}`);
      router.refresh();
    } catch {
      alert("Chyba při komunikaci se serverem");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
        <div className="text-center">
          <BookOpen className="mx-auto h-10 w-10 text-[var(--primary)]" />
          <h1 className="mt-4 text-2xl font-bold">Vítejte ve Finančním Deníku</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Vytvořte svůj první peněžní deník a začněte sledovat své finance.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Název deníku
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="např. Osobní finance"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Typ deníku
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as JournalType)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="standard">Standardní deník — příjmy a výdaje</option>
              <option value="cashflow">Cashflow / pohledávkový — sledování dluhu</option>
            </select>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {type === "cashflow"
                ? "Pro sledování pohledávek, dluhů a splátek."
                : "Pro běžné osobní nebo firemní finance."}
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Vytvářím..." : "Vytvořit deník"}
          </button>
        </div>
      </div>
    </div>
  );
}
