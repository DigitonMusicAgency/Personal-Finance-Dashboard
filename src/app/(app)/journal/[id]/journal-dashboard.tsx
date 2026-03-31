"use client";

import { useState } from "react";
import type { Journal, Account, Category } from "@/lib/types";
import AccountManager from "./account-manager";
import JournalSettings from "./journal-settings";
import { LayoutDashboard, CreditCard, Settings } from "lucide-react";

type Tab = "dashboard" | "accounts" | "settings";

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

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
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
      key: "settings",
      label: "Nastavení",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

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
          <DashboardPlaceholder
            journal={journal}
            accountCount={accounts.length}
          />
        )}
        {tab === "accounts" && (
          <AccountManager
            journalId={journal.id}
            accounts={accounts}
            onAccountsChange={setAccounts}
          />
        )}
        {tab === "settings" && <JournalSettings journal={journal} />}
      </div>
    </div>
  );
}

function DashboardPlaceholder({
  journal,
  accountCount,
}: {
  journal: Journal;
  accountCount: number;
}) {
  return (
    <div className="space-y-6">
      {accountCount === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-[var(--muted-foreground)]" />
          <h3 className="mt-4 text-lg font-medium">Zatím žádné účty</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Přejděte na záložku &quot;Účty&quot; a přidejte svůj první bankovní
            účet.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <LayoutDashboard className="mx-auto h-12 w-12 text-[var(--muted-foreground)]" />
          <h3 className="mt-4 text-lg font-medium">
            Dashboard bude zde
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Metriky, grafy a tabulka transakcí — přijdou ve Sprint 2 a 3.
          </p>
        </div>
      )}
    </div>
  );
}
