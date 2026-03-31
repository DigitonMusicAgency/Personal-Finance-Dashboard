"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Journal, JournalType } from "@/lib/types";
import {
  BookOpen,
  Plus,
  Archive,
  Pencil,
  Check,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  Wallet,
  HandCoins,
} from "lucide-react";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<JournalType>("standard");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  // Get the currently selected journal ID from the URL
  const currentJournalId = pathname.startsWith("/journal/")
    ? pathname.split("/")[2]
    : null;

  useEffect(() => {
    loadJournals();
  }, []);

  async function loadJournals() {
    const { data } = await supabase
      .from("journals")
      .select("*")
      .order("sort_order")
      .order("created_at");

    if (data) setJournals(data);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("journals")
      .insert({
        name: newName.trim(),
        type: newType,
        sort_order: journals.length,
      })
      .select("id")
      .single();

    if (error) {
      alert("Chyba: " + error.message);
      setLoading(false);
      return;
    }

    setNewName("");
    setNewType("standard");
    setShowNewForm(false);
    setLoading(false);
    await loadJournals();
    router.push(`/journal/${data.id}`);
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;

    const { error } = await supabase
      .from("journals")
      .update({ name: editName.trim() })
      .eq("id", id);

    if (error) {
      alert("Chyba: " + error.message);
      return;
    }

    setEditingId(null);
    await loadJournals();
  }

  async function handleArchive(id: string) {
    const journal = journals.find((j) => j.id === id);
    if (!journal) return;

    const { error } = await supabase
      .from("journals")
      .update({ is_archived: !journal.is_archived })
      .eq("id", id);

    if (error) {
      alert("Chyba: " + error.message);
      return;
    }

    await loadJournals();

    // If we archived the currently viewed journal, go to first active one
    if (!journal.is_archived && id === currentJournalId) {
      const active = journals.find((j) => j.id !== id && !j.is_archived);
      if (active) {
        router.push(`/journal/${active.id}`);
      } else {
        router.push("/welcome");
      }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const activeJournals = journals.filter((j) => !j.is_archived);
  const archivedJournals = journals.filter((j) => j.is_archived);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-4">
        <BookOpen className="h-5 w-5 text-[var(--primary)]" />
        <span className="font-semibold tracking-tight">Finanční Deník</span>
      </div>

      {/* Journal list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
            Deníky
          </span>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Nový deník"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* New journal form */}
        {showNewForm && (
          <div className="mb-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Název deníku"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowNewForm(false);
              }}
              className="w-full rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as JournalType)}
              className="w-full rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
            >
              <option value="standard">Standardní</option>
              <option value="cashflow">Cashflow / pohledávka</option>
            </select>
            <div className="flex gap-1">
              <button
                onClick={handleCreate}
                disabled={loading || !newName.trim()}
                className="flex-1 rounded bg-[var(--primary)] px-2 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                Vytvořit
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        {/* Active journals */}
        <div className="space-y-0.5">
          {activeJournals.map((journal) => (
            <div key={journal.id} className="group relative">
              {editingId === journal.id ? (
                <div className="flex items-center gap-1 rounded-lg px-2 py-1.5">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(journal.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 rounded border border-[var(--border)] bg-[var(--input)] px-2 py-0.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    onClick={() => handleRename(journal.id)}
                    className="rounded p-0.5 text-emerald-400 hover:bg-[var(--accent)]"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push(`/journal/${journal.id}`)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    currentJournalId === journal.id
                      ? "bg-[var(--accent)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {journal.type === "cashflow" ? (
                    <HandCoins className="h-4 w-4 shrink-0" />
                  ) : (
                    <Wallet className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">{journal.name}</span>

                  {/* Edit / Archive buttons on hover */}
                  <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(journal.id);
                        setEditName(journal.name);
                      }}
                      className="rounded p-0.5 hover:bg-[var(--border)]"
                    >
                      <Pencil className="h-3 w-3" />
                    </span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(journal.id);
                      }}
                      className="rounded p-0.5 hover:bg-[var(--border)]"
                    >
                      <Archive className="h-3 w-3" />
                    </span>
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Archived journals */}
        {archivedJournals.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex w-full items-center gap-1 px-2 py-1 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {showArchived ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Archivované ({archivedJournals.length})
            </button>
            {showArchived && (
              <div className="mt-1 space-y-0.5">
                {archivedJournals.map((journal) => (
                  <div key={journal.id} className="group flex items-center">
                    <button
                      onClick={() => router.push(`/journal/${journal.id}`)}
                      className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] opacity-60 hover:bg-[var(--accent)] hover:opacity-100"
                    >
                      <Archive className="h-4 w-4 shrink-0" />
                      <span className="truncate">{journal.name}</span>
                    </button>
                    <button
                      onClick={() => handleArchive(journal.id)}
                      className="mr-1 rounded px-1.5 py-0.5 text-xs text-[var(--muted-foreground)] opacity-0 hover:bg-[var(--accent)] group-hover:opacity-100"
                      title="Obnovit"
                    >
                      Obnovit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-3 py-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <LogOut className="h-4 w-4" />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
