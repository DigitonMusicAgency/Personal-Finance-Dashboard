import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Nepřihlášený uživatel" },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = await request.json();
    const { import_id, transactions } = body;

    if (!import_id || !transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "Chybí import_id nebo transakce" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 3. Verify the import record exists and belongs to user
    const { data: importRecord } = await admin
      .from("document_imports")
      .select("id, journal_id, status")
      .eq("id", import_id)
      .single();

    if (!importRecord) {
      return NextResponse.json(
        { error: "Import nenalezen" },
        { status: 404 }
      );
    }

    if (importRecord.status !== "review") {
      return NextResponse.json(
        { error: "Import již byl zpracován" },
        { status: 400 }
      );
    }

    // Verify journal ownership
    const { data: journal } = await admin
      .from("journals")
      .select("id")
      .eq("id", importRecord.journal_id)
      .eq("user_id", user.id)
      .single();

    if (!journal) {
      return NextResponse.json(
        { error: "Přístup odepřen" },
        { status: 403 }
      );
    }

    // 4. Insert all transactions
    const txPayloads = transactions.map((tx: Record<string, unknown>) => ({
      account_id: tx.account_id,
      journal_id: tx.journal_id,
      date: tx.date,
      amount: tx.amount,
      currency: tx.currency,
      amount_czk: tx.amount_czk,
      exchange_rate: tx.exchange_rate || 1.0,
      type: tx.type,
      description: tx.description || null,
      counterparty: tx.counterparty || null,
      category_id: tx.category_id || null,
      note: tx.note || null,
      source: tx.source || "import_csv",
      document_import_id: import_id,
      external_id: tx.external_id || null,
      original_amount: tx.original_amount || null,
      original_currency: tx.original_currency || null,
      is_confirmed: true,
    }));

    const { error: txError } = await admin
      .from("transactions")
      .insert(txPayloads);

    if (txError) {
      console.error("Transaction insert error:", txError);
      return NextResponse.json(
        { error: "Chyba při ukládání transakcí: " + txError.message },
        { status: 500 }
      );
    }

    // 5. Update import status
    const { error: updateError } = await admin
      .from("document_imports")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        transaction_count: transactions.length,
      })
      .eq("id", import_id);

    if (updateError) {
      console.error("Import status update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      transaction_count: transactions.length,
    });
  } catch (err) {
    console.error("Import confirm error:", err);
    return NextResponse.json(
      { error: "Neočekávaná chyba serveru" },
      { status: 500 }
    );
  }
}
