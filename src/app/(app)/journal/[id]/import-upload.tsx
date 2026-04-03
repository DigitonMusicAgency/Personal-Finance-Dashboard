"use client";

import { useState, useRef, DragEvent } from "react";
import type { Account } from "@/lib/types";
import { X, Upload, FileText, Check, Loader2, AlertCircle } from "lucide-react";

interface Props {
  journalId: string;
  accounts: Account[];
  onImportParsed: (data: {
    importId: string;
    transactions: unknown[];
    fileName: string;
    accountId: string;
  }) => void;
  onClose: () => void;
}

type Step = "idle" | "uploading" | "processing" | "done" | "error";

export default function ImportUpload({
  journalId,
  accounts,
  onImportParsed,
  onClose,
}: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(selectedFile: File) {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "pdf") {
      setError("Nepodporovaný formát. Použijte CSV nebo PDF.");
      return;
    }
    setError("");
    setFile(selectedFile);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleUpload() {
    if (!file || !accountId) return;

    setStep("uploading");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("journal_id", journalId);
      formData.append("account_id", accountId);

      setStep("processing");

      const res = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Chyba při zpracování souboru");
        setStep("error");
        return;
      }

      setStep("done");

      // Small delay so user sees the success state
      setTimeout(() => {
        onImportParsed({
          importId: data.import_id,
          transactions: data.transactions,
          fileName: data.file_name,
          accountId,
        });
      }, 500);
    } catch {
      setError("Chyba při komunikaci se serverem");
      setStep("error");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const isProcessing = step === "uploading" || step === "processing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Import dokumentu</h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Account selector */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
              Účet *
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={isProcessing}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] disabled:opacity-50"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>

          {/* File drop zone */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--border)] hover:border-[var(--muted-foreground)]"
              }`}
            >
              <Upload className="mx-auto h-10 w-10 text-[var(--muted-foreground)]" />
              <p className="mt-3 text-sm font-medium">
                Přetáhněte soubor sem
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                nebo klikněte pro výběr
              </p>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Podporované formáty: Wise CSV, Air Bank PDF, Wise PDF
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                {!isProcessing && step !== "done" && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setStep("idle");
                      setError("");
                    }}
                    className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Processing steps */}
              {isProcessing || step === "done" ? (
                <div className="mt-4 space-y-2">
                  <StepItem
                    label="Nahrávání souboru"
                    done={step !== "uploading"}
                    active={step === "uploading"}
                  />
                  <StepItem
                    label="Zpracování dokumentu"
                    done={step === "done"}
                    active={step === "processing"}
                  />
                  <StepItem
                    label="Příprava transakcí"
                    done={step === "done"}
                    active={false}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>{error}</p>
                {step === "error" && (
                  <button
                    onClick={() => {
                      setStep("idle");
                      setError("");
                    }}
                    className="mt-1 text-xs underline hover:no-underline"
                  >
                    Zkusit znovu
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Upload button */}
          {file && !isProcessing && step !== "done" && (
            <button
              onClick={handleUpload}
              disabled={!accountId}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Nahrát a zpracovat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepItem({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
      ) : (
        <span className="h-4 w-4 rounded-full border border-[var(--border)]" />
      )}
      <span
        className={
          done
            ? "text-emerald-400"
            : active
            ? "text-[var(--foreground)]"
            : "text-[var(--muted-foreground)]"
        }
      >
        {label}
      </span>
    </div>
  );
}
