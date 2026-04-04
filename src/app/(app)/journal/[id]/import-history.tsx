"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Loader2, FileText } from "lucide-react";
import { formatDateShort } from "@/lib/utils";

interface Import {
  id: string;
  file_name: string;
  source_type: string;
  status: string;
  transaction_count: number;
  confirmed_at: string | null;
  created_at: string;
}

interface Props {
  journalId: string;
  refreshKey: number;
  onDeleted: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  airbank_pdf: "PDF",
  wise_csv: "CSV",
  wise_pdf: "PDF",
};

export default function ImportHistory({ journalId, refreshKey, onDeleted }: Props) {
  const [imports, setImports] = useState<Import[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadImports = useCallback(async () => {
    try {
      const res = await fetch(`/api/imports?journal_id=${journalId}`);
      if (res.ok) {
        const data = await res.json();
        setImports(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    loadImports();
  }, [loadImports, refreshKey]);

  async function handleDelete(importId: string, fileName: string) {
    if (!confirm(`Opravdu chcete smazat všechny transakce z importu "${fileName}"?`)) return;

    setDeletingId(importId);
    try {
      const res = await fetch("/api/imports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ import_id: importId }),
      });

      if (res.ok) {
        const data = await res.json();
        setImports((prev) => prev.filter((i) => i.id !== importId));
        alert(`Smazáno ${data.deleted_count} transakcí`);
        onDeleted();
      } else {
        const data = await res.json();
        alert("Chyba: " + (data.error || "Neznámá chyba"));
      }
    } catch {
      alert("Chyba při komunikaci se serverem");
    }
    setDeletingId(null);
  }

  if (loading) return null;
  if (imports.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Historie importů</h3>
      <div className="grid gap-2">
        {imports.map((imp) => (
          <div
            key={imp.id}
            className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
          >
            <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate block">{imp.file_name}</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatDateShort(imp.created_at)} · {imp.transaction_count} transakcí · {SOURCE_LABELS[imp.source_type] || imp.source_type}
              </span>
            </div>
            <button
              onClick={() => handleDelete(imp.id, imp.file_name)}
              disabled={deletingId === imp.id}
              className="rounded p-1.5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              title="Smazat všechny transakce z tohoto importu"
            >
              {deletingId === imp.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
