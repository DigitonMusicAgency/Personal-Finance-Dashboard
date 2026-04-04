"use client";

import { useState, useEffect, useCallback } from "react";
import type { Journal, Account, Category, Transaction } from "@/lib/types";
import AccountManager from "./account-manager";
import JournalSettings from "./journal-settings";
import TransactionTable from "./transaction-table";
import TransactionForm from "./transaction-form";
import PeriodFilterBar, {
  type PeriodFilter,
  getDefaultPeriod,
  getDefaultPeriods,
} from "./period-filter";
import { MetricCards } from "./metric-cards";
import DashboardCharts from "./dashboard-charts";
import ImportUpload from "./import-upload";
import ImportReview from "./import-review";
import CategoryManager from "./category-manager";
import CashflowOverview from "./cashflow-overview";
import ImportHistory from "./import-history";
import type { ParsedTransaction } from "@/lib/parsers/wise-csv";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  Tag,
  Plus,
  Upload,
  Loader2,
} from "lucide-react";

type Tab = "dashboard" | "accounts" | "categories" | "settings";

interface Props {
  journal: Journal;
  accounts: Account[];
  categories: Category[];
}

export default function JournalDashboard({
  journal,
  accounts: initialAccounts,
  categories,
}: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [accounts, setAccounts] = useState(initialAccounts);
  const [cats, setCats] = useState(categories);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Import flow state
  const [showImportUpload, setShowImportUpload] = useState(false);
  const [importReview, setImportReview] = useState<{
    importId: string;
    transactions: ParsedTransaction[];
    fileName: string;
    accountId: string;
  } | null>(null);

  const allTabs: { key: Tab; label: string; icon: React.ReactNode; hideForCashflow?: boolean }[] = [
    {
      key: "dashboard",
      label: "Přehled",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      key: "accounts",
      label: "Účty",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      key: "categories",
      label: "Kategorie",
      icon: <Tag className="h-4 w-4" />,
      hideForCashflow: true,
    },
    {
      key: "settings",
      label: "Nastavení",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const tabs = allTabs.filter(
    (t) => !t.hideForCashflow || journal.type !== "cashflow"
  );

  function handleNewTransaction() {
    setEditingTransaction(null);
    setShowTransactionForm(true);
  }

  function handleEditTransaction(tx: Transaction) {
    setEditingTransaction(tx);
    setShowTransactionForm(true);
  }

  function handleTransactionSaved() {
    setShowTransactionForm(false);
    setEditingTransaction(null);
    setRefreshKey((k) => k + 1);
  }

  function handleCloseForm() {
    setShowTransactionForm(false);
    setEditingTransaction(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 pt-6 pb-0">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{journal.name}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {journal.type === "cashflow"
                ? "Cashflow / pohledávkový deník"
                : "Standardní deník"}
              {journal.counterparty_name &&
                ` — ${journal.counterparty_name}`}
            </p>
          </div>

          {/* Action buttons */}
          {tab === "dashboard" && (
            <div className="flex items-center gap-2">
              {journal.type !== "cashflow" && accounts.length > 0 && (
                <button
                  onClick={() => setShowImportUpload(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
              )}
              <button
                onClick={handleNewTransaction}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                Přidat transakci
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-b-2 border-[var(--primary)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "dashboard" && (
          <DashboardContent
            journal={journal}
            accounts={accounts}
            categories={cats}
            onNewTransaction={handleNewTransaction}
            onEditTransaction={handleEditTransaction}
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        )}
        {tab === "accounts" && (
          <AccountManager
            journalId={journal.id}
            accounts={accounts}
            onAccountsChange={setAccounts}
          />
        )}
        {tab === "categories" && (
          <CategoryManager
            journalId={journal.id}
            categories={cats}
            onCategoriesChange={setCats}
          />
        )}
        {tab === "settings" && <JournalSettings journal={journal} />}
      </div>

      {/* Transaction form modal */}
      {showTransactionForm && (
        <TransactionForm
          journal={journal}
          accounts={accounts}
          categories={cats}
          transaction={editingTransaction}
          onClose={handleCloseForm}
          onSaved={handleTransactionSaved}
        />
      )}

      {/* Import upload modal */}
      {showImportUpload && (
        <ImportUpload
          journalId={journal.id}
          accounts={accounts}
          onImportParsed={(data) => {
            setShowImportUpload(false);
            setImportReview(data as {
              importId: string;
              transactions: ParsedTransaction[];
              fileName: string;
              accountId: string;
            });
          }}
          onClose={() => setShowImportUpload(false)}
        />
      )}

      {/* Import review screen */}
      {importReview && (
        <ImportReview
          journalId={journal.id}
          accountId={importReview.accountId}
          importId={importReview.importId}
          transactions={importReview.transactions}
          categories={cats}
          fileName={importReview.fileName}
          onConfirmed={() => {
            setImportReview(null);
            setRefreshKey((k) => k + 1);
          }}
          onCancelled={() => setImportReview(null)}
        />
      )}
    </div>
  );
}

/**
 * Compute the "previous period" date range for comparison.
 * E.g., if current is "this month" (Apr 2026), previous is Mar 2026.
 */
function getPreviousPeriod(period: PeriodFilter): PeriodFilter {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  const durationMs = end.getTime() - start.getTime();

  const prevEnd = new Date(start.getTime() - 1); // day before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return {
    key: "previous",
    label: "Předchozí",
    startDate: fmt(prevStart),
    endDate: fmt(prevEnd),
  };
}

function DashboardContent({
  journal,
  accounts,
  categories,
  onNewTransaction,
  onEditTransaction,
  refreshKey,
  onRefresh,
}: {
  journal: Journal;
  accounts: Account[];
  categories: Category[];
  onNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [period, setPeriod] = useState<PeriodFilter>(() => {
    try {
      const savedKey = localStorage.getItem(`period-filter-${journal.id}`);
      if (savedKey) {
        const periods = getDefaultPeriods();
        const found = periods.find((p) => p.key === savedKey);
        if (found) return found;
      }
    } catch { /* ignore */ }
    return getDefaultPeriod();
  });

  function handlePeriodChange(newPeriod: PeriodFilter) {
    setPeriod(newPeriod);
    try {
      localStorage.setItem(`period-filter-${journal.id}`, newPeriod.key);
    } catch { /* ignore */ }
  }
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch ALL transactions for this journal (we filter client-side for metrics/charts)
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/transactions?journal_id=${journal.id}&limit=5000`
      );
      if (res.ok) {
        const data = await res.json();
        setAllTransactions(data);
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [journal.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshKey]);

  // Filter transactions by selected period
  const filteredTransactions = allTransactions.filter(
    (t) => t.date >= period.startDate && t.date <= period.endDate
  );

  // Previous period for comparison
  const prevPeriod = getPreviousPeriod(period);
  const prevTransactions = allTransactions.filter(
    (t) => t.date >= prevPeriod.startDate && t.date <= prevPeriod.endDate
  );

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <PeriodFilterBar value={period} onChange={handlePeriodChange} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : journal.type === "cashflow" ? (
        /* Cashflow journal: dedicated overview only */
        <CashflowOverview
          journal={journal}
          transactions={filteredTransactions}
          onEditTransaction={onEditTransaction}
        />
      ) : (
        <>
          {/* Standard journal: metrics + charts */}
          <MetricCards
            transactions={filteredTransactions}
            previousTransactions={prevTransactions}
          />

          <DashboardCharts
            transactions={filteredTransactions}
            categories={categories}
          />
        </>
      )}

      {/* Transaction table (both types) */}
      {journal.type !== "cashflow" && (
        <TransactionTable
          journalId={journal.id}
          accounts={accounts}
          categories={categories}
          onEditTransaction={onEditTransaction}
          refreshKey={refreshKey}
          startDate={period.startDate}
          endDate={period.endDate}
        />
      )}

      {/* Import history (standard only) */}
      {journal.type !== "cashflow" && (
        <ImportHistory
          journalId={journal.id}
          refreshKey={refreshKey}
          onDeleted={onRefresh}
        />
      )}
    </div>
  );
}
