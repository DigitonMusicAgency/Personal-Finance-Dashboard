"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, CategorizationRule } from "@/lib/types";
import { Plus, Pencil, X, Check, Tag, ArrowRight, ChevronUp, ChevronDown, Play, Loader2 } from "lucide-react";

const COLOR_PRESETS = [
  "#EF4444", "#F97316", "#F59E0B", "#10B981", "#06B6D4",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#78716C",
];

interface Props {
  journalId: string;
  categories: Category[];
  onCategoriesChange: (categories: Category[]) => void;
}

interface CategoryFormData {
  name: string;
  color: string;
}

const emptyForm: CategoryFormData = {
  name: "",
  color: COLOR_PRESETS[5],
};

interface RuleFormData {
  match_field: "counterparty" | "description";
  match_value: string;
  category_id: string;
}

interface RuleWithCategory extends CategorizationRule {
  category?: Category;
}

export default function CategoryManager({
  journalId,
  categories,
  onCategoriesChange,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormData>(emptyForm);
  const [loading, setLoading] = useState(false);

  const [rules, setRules] = useState<RuleWithCategory[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleFormData>({
    match_field: "counterparty",
    match_value: "",
    category_id: "",
  });
  const [ruleLoading, setRuleLoading] = useState(false);
  const [applyingRuleId, setApplyingRuleId] = useState<string | null>(null);
  const [applyingDefault, setApplyingDefault] = useState(false);

  const supabase = createClient();

  // Load rules on mount
  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalId]);

  async function loadRules() {
    const { data, error } = await supabase
      .from("categorization_rules")
      .select("*")
      .eq("journal_id", journalId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load rules:", error);
      return;
    }

    // Join with categories locally
    const rulesWithCategory: RuleWithCategory[] = (data ?? []).map((rule) => ({
      ...rule,
      category: categories.find((c) => c.id === rule.category_id),
    }));
    setRules(rulesWithCategory);
  }

  // Refresh rule category references when categories change
  useEffect(() => {
    setRules((prev) =>
      prev.map((rule) => ({
        ...rule,
        category: categories.find((c) => c.id === rule.category_id),
      }))
    );
  }, [categories]);

  function updateForm(field: keyof CategoryFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      color: category.color ?? COLOR_PRESETS[5],
    });
    setShowForm(false);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);

    const payload = {
      journal_id: journalId,
      name: form.name.trim(),
      color: form.color || null,
    };

    let result;
    if (editingId) {
      result = await supabase
        .from("categories")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("categories")
        .insert({ ...payload, sort_order: categories.length })
        .select()
        .single();
    }

    if (result.error) {
      alert("Chyba: " + result.error.message);
      setLoading(false);
      return;
    }

    if (editingId) {
      onCategoriesChange(
        categories.map((c) => (c.id === editingId ? result.data : c))
      );
    } else {
      onCategoriesChange([...categories, result.data]);
    }

    cancelForm();
    setLoading(false);
  }

  async function handleMoveCategory(index: number, direction: "up" | "down") {
    const sorted = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    // Normalize: assign sequential sort_order to all categories first
    // This fixes issues when multiple categories share the same sort_order
    const normalized = sorted.map((c, i) => ({ ...c, sort_order: i }));

    // Now swap
    const newOrder = [...normalized];
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];

    // Reassign sequential sort_order after swap
    const final = newOrder.map((c, i) => ({ ...c, sort_order: i }));

    // Update all changed sort_orders in DB
    await Promise.all(
      final.map((c) =>
        supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id)
      )
    );

    onCategoriesChange(final);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Opravdu chcete deaktivovat tuto kategorii?")) return;

    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      alert("Chyba: " + error.message);
      return;
    }

    onCategoriesChange(categories.filter((c) => c.id !== id));
  }

  // --- Rules ---

  async function handleAddRule() {
    if (!ruleForm.match_value.trim() || !ruleForm.category_id) return;
    setRuleLoading(true);

    const payload = {
      journal_id: journalId,
      match_field: ruleForm.match_field,
      match_value: ruleForm.match_value.trim(),
      category_id: ruleForm.category_id,
    };

    const { data, error } = await supabase
      .from("categorization_rules")
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert("Chyba: " + error.message);
      setRuleLoading(false);
      return;
    }

    const ruleWithCategory: RuleWithCategory = {
      ...data,
      category: categories.find((c) => c.id === data.category_id),
    };
    setRules((prev) => [ruleWithCategory, ...prev]);
    setRuleForm({ match_field: "counterparty", match_value: "", category_id: "" });
    setShowRuleForm(false);
    setRuleLoading(false);
  }

  async function handleDeleteRule(id: string) {
    if (!confirm("Opravdu chcete smazat toto pravidlo?")) return;

    const { error } = await supabase
      .from("categorization_rules")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Chyba: " + error.message);
      return;
    }

    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleApplyRule(rule: RuleWithCategory) {
    setApplyingRuleId(rule.id);
    try {
      // Fetch all transactions
      const res = await fetch(`/api/transactions?journal_id=${journalId}&limit=5000`);
      if (!res.ok) { setApplyingRuleId(null); return; }
      const transactions = await res.json();

      // Find matching transactions without a category
      const matching = transactions.filter((tx: Record<string, string | null>) => {
        const fieldValue = tx[rule.match_field] || "";
        return fieldValue.toLowerCase().includes(rule.match_value.toLowerCase()) && !tx.category_id;
      });

      // Update each matching transaction
      let updated = 0;
      for (const tx of matching) {
        const patchRes = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tx.id, category_id: rule.category_id }),
        });
        if (patchRes.ok) updated++;
      }

      alert(`Pravidlo aplikováno na ${updated} transakcí${updated === 0 ? " (žádné nekategorizované shody)" : ""}`);
    } catch {
      alert("Chyba při aplikaci pravidla");
    }
    setApplyingRuleId(null);
  }

  // Sort categories by sort_order
  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      {/* Section 1: Categories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kategorie</h2>
          {!showForm && !editingId && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              <Plus className="h-4 w-4" />
              Přidat kategorii
            </button>
          )}
        </div>

        {/* Category form */}
        {(showForm || editingId) && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
            <h3 className="font-medium">
              {editingId ? "Upravit kategorii" : "Nová kategorie"}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                  Název *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="např. Jídlo"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                  Barva
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => updateForm("color", e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
                  />
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {form.color}
                  </span>
                </div>
              </div>
            </div>

            {/* Color presets */}
            <div>
              <label className="mb-1.5 block text-sm text-[var(--muted-foreground)]">
                Rychlý výběr barvy
              </label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateForm("color", color)}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor:
                        form.color === color
                          ? "var(--foreground)"
                          : "transparent",
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={loading || !form.name.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {loading
                  ? "Ukládám..."
                  : editingId
                    ? "Uložit změny"
                    : "Přidat kategorii"}
              </button>
              <button
                onClick={cancelForm}
                className="rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        {/* Category list */}
        {categories.length === 0 && !showForm ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <Tag className="mx-auto h-10 w-10 text-[var(--muted-foreground)]" />
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Zatím nemáte žádné kategorie. Přidejte svou první kategorii.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedCategories.map((category, idx) => (
              <div
                key={category.id}
                className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveCategory(idx, "up")}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-20"
                    title="Posunout nahoru"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleMoveCategory(idx, "down")}
                    disabled={idx === sortedCategories.length - 1}
                    className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-20"
                    title="Posunout dolů"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{
                    backgroundColor: category.color ?? "#6B7280",
                  }}
                />
                <span className="flex-1 text-sm font-medium">
                  {category.name}
                </span>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(category)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Upravit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeactivate(category.id)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400"
                    title="Deaktivovat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Income Category */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2">
        <label className="text-sm font-medium">Výchozí kategorie pro příjmy</label>
        <p className="text-xs text-[var(--muted-foreground)]">
          Automaticky se přiřadí novým příjmovým transakcím při importu.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={(() => {
              try { return localStorage.getItem(`default-income-category-${journalId}`) || ""; } catch { return ""; }
            })()}
            onChange={(e) => {
              try {
                if (e.target.value) {
                  localStorage.setItem(`default-income-category-${journalId}`, e.target.value);
                } else {
                  localStorage.removeItem(`default-income-category-${journalId}`);
                }
              } catch { /* ignore */ }
              // Force re-render
              setForm((prev) => ({ ...prev }));
            }}
            className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="">Žádná (nepřiřazovat)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              let catId: string | null = null;
              try { catId = localStorage.getItem(`default-income-category-${journalId}`); } catch { /* */ }
              if (!catId) { alert("Nejprve vyberte výchozí kategorii"); return; }
              setApplyingDefault(true);
              try {
                const res = await fetch(`/api/transactions?journal_id=${journalId}&limit=5000`);
                if (!res.ok) { setApplyingDefault(false); return; }
                const txs = await res.json();
                const matching = txs.filter((tx: Record<string, string | null>) =>
                  tx.type === "income" && !tx.category_id
                );
                let updated = 0;
                for (const tx of matching) {
                  const patchRes = await fetch("/api/transactions", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: tx.id, category_id: catId }),
                  });
                  if (patchRes.ok) updated++;
                }
                alert(`Kategorie přiřazena ${updated} příjmovým transakcím${updated === 0 ? " (žádné nekategorizované příjmy)" : ""}`);
              } catch { alert("Chyba při aplikaci kategorie"); }
              setApplyingDefault(false);
            }}
            disabled={applyingDefault}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
            title="Aplikovat na existující nekategorizované příjmy"
          >
            {applyingDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Aplikovat
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* Section 2: Categorization Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pravidla kategorizace</h2>
          {!showRuleForm && (
            <button
              onClick={() => setShowRuleForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              <Plus className="h-4 w-4" />
              Přidat pravidlo
            </button>
          )}
        </div>

        {/* Rule form */}
        {showRuleForm && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
            <h3 className="font-medium">Nové pravidlo</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                  Pole
                </label>
                <select
                  value={ruleForm.match_field}
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      match_field: e.target.value as "counterparty" | "description",
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                >
                  <option value="counterparty">Protistrana</option>
                  <option value="description">Popis</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                  Obsahuje text *
                </label>
                <input
                  type="text"
                  value={ruleForm.match_value}
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      match_value: e.target.value,
                    }))
                  }
                  placeholder="např. Albert"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[var(--muted-foreground)]">
                  Kategorie *
                </label>
                <select
                  value={ruleForm.category_id}
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      category_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                >
                  <option value="">Vyberte kategorii</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddRule}
                disabled={
                  ruleLoading ||
                  !ruleForm.match_value.trim() ||
                  !ruleForm.category_id
                }
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {ruleLoading ? "Ukládám..." : "Přidat pravidlo"}
              </button>
              <button
                onClick={() => {
                  setShowRuleForm(false);
                  setRuleForm({
                    match_field: "counterparty",
                    match_value: "",
                    category_id: "",
                  });
                }}
                className="rounded-lg px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        {/* Rules list */}
        {rules.length === 0 && !showRuleForm ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <ArrowRight className="mx-auto h-10 w-10 text-[var(--muted-foreground)]" />
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Zatím nemáte žádná pravidla. Pravidla automaticky přiřazují
              kategorie importovaným transakcím.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="group flex items-center gap-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <span className="text-[var(--muted-foreground)]">
                  {rule.match_field === "counterparty"
                    ? "Protistrana"
                    : "Popis"}
                </span>
                <span className="font-medium">&lsquo;{rule.match_value}&rsquo;</span>
                <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                {rule.category && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: rule.category.color ?? "#6B7280",
                      }}
                    />
                    <span className="font-medium">{rule.category.name}</span>
                  </span>
                )}
                {!rule.category && (
                  <span className="text-[var(--muted-foreground)] italic">
                    Smazaná kategorie
                  </span>
                )}
                <div className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleApplyRule(rule)}
                    disabled={applyingRuleId === rule.id}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
                    title="Aplikovat na existující transakce"
                  >
                    {applyingRuleId === rule.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400"
                    title="Smazat pravidlo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
