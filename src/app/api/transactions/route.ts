import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Helper: verify user is authenticated, return user or error response
async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: "Nepřihlášený uživatel" }, { status: 401 }) };
  }
  return { user, error: null };
}

// Helper: verify journal belongs to user
async function verifyJournalOwnership(admin: ReturnType<typeof createAdminClient>, journalId: string, userId: string) {
  const { data } = await admin
    .from("journals")
    .select("id")
    .eq("id", journalId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

/**
 * GET /api/transactions?journal_id=XXX&account_id=YYY&type=ZZZ&category_id=AAA&limit=100&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const journalId = searchParams.get("journal_id");

    if (!journalId) {
      return NextResponse.json({ error: "Chybí journal_id" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify ownership
    if (!(await verifyJournalOwnership(admin, journalId, user!.id))) {
      return NextResponse.json({ error: "Deník nenalezen" }, { status: 404 });
    }

    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const accountId = searchParams.get("account_id");
    const type = searchParams.get("type");
    const categoryId = searchParams.get("category_id");

    let query = admin
      .from("transactions")
      .select("*, category:categories(*), account:accounts(id, name, currency, bank_service)")
      .eq("journal_id", journalId)
      .eq("is_deleted", false)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountId) query = query.eq("account_id", accountId);
    if (type) query = query.eq("type", type);
    if (categoryId) query = query.eq("category_id", categoryId);

    const { data, error } = await query;

    if (error) {
      console.error("Transaction fetch error:", error);
      return NextResponse.json({ error: "Chyba při načítání transakcí" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Neočekávaná chyba serveru" }, { status: 500 });
  }
}

/**
 * POST /api/transactions — Create a new transaction
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const body = await request.json();
    const {
      account_id,
      journal_id,
      date,
      amount,
      currency,
      amount_czk,
      exchange_rate,
      type,
      description,
      counterparty,
      category_id,
      note,
      source,
      variable_symbol,
      original_amount,
      original_currency,
    } = body;

    if (!journal_id || !date || amount === undefined || !currency || amount_czk === undefined || !type || !source) {
      return NextResponse.json({ error: "Chybí povinné údaje transakce" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify ownership
    if (!(await verifyJournalOwnership(admin, journal_id, user!.id))) {
      return NextResponse.json({ error: "Deník nenalezen" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("transactions")
      .insert({
        account_id: account_id || null,
        journal_id,
        date,
        amount,
        currency,
        amount_czk,
        exchange_rate: exchange_rate || 1.0,
        type,
        description: description || null,
        counterparty: counterparty || null,
        category_id: category_id || null,
        note: note || null,
        source,
        variable_symbol: variable_symbol || null,
        original_amount: original_amount || null,
        original_currency: original_currency || null,
        is_confirmed: true,
      })
      .select("*, category:categories(*), account:accounts(id, name, currency, bank_service)")
      .single();

    if (error) {
      console.error("Transaction create error:", error);
      return NextResponse.json({ error: "Chyba při vytváření transakce: " + error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Neočekávaná chyba serveru" }, { status: 500 });
  }
}

/**
 * PATCH /api/transactions — Update a transaction
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Chybí ID transakce" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the transaction to verify ownership
    const { data: existing } = await admin
      .from("transactions")
      .select("journal_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Transakce nenalezena" }, { status: 404 });
    }

    if (!(await verifyJournalOwnership(admin, existing.journal_id, user!.id))) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    // Only allow updating specific fields
    const allowedFields = [
      "date", "amount", "currency", "amount_czk", "exchange_rate",
      "type", "description", "counterparty", "category_id", "note",
      "account_id", "variable_symbol",
    ];

    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        safeUpdates[key] = updates[key] === "" ? null : updates[key];
      }
    }

    const { data, error } = await admin
      .from("transactions")
      .update(safeUpdates)
      .eq("id", id)
      .select("*, category:categories(*), account:accounts(id, name, currency, bank_service)")
      .single();

    if (error) {
      console.error("Transaction update error:", error);
      return NextResponse.json({ error: "Chyba při aktualizaci transakce: " + error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Neočekávaná chyba serveru" }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions?id=XXX — Soft delete a transaction
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Chybí ID transakce" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch to verify ownership
    const { data: existing } = await admin
      .from("transactions")
      .select("journal_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Transakce nenalezena" }, { status: 404 });
    }

    if (!(await verifyJournalOwnership(admin, existing.journal_id, user!.id))) {
      return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
    }

    const { error } = await admin
      .from("transactions")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) {
      console.error("Transaction delete error:", error);
      return NextResponse.json({ error: "Chyba při mazání transakce" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Neočekávaná chyba serveru" }, { status: 500 });
  }
}
