import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { import_id } = body;

    if (!import_id) {
      return NextResponse.json(
        { error: "Chybí import_id" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify the import record exists and belongs to user
    const { data: importRecord } = await admin
      .from("document_imports")
      .select("id, journal_id")
      .eq("id", import_id)
      .single();

    if (!importRecord) {
      return NextResponse.json(
        { error: "Import nenalezen" },
        { status: 404 }
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

    // Soft-delete all transactions from this import
    const { data: deleted, error: txError } = await admin
      .from("transactions")
      .update({ is_deleted: true })
      .eq("document_import_id", import_id)
      .eq("is_deleted", false)
      .select("id");

    if (txError) {
      console.error("Bulk delete error:", txError);
      return NextResponse.json(
        { error: "Chyba při mazání transakcí" },
        { status: 500 }
      );
    }

    // Update import status
    await admin
      .from("document_imports")
      .update({ status: "deleted" })
      .eq("id", import_id);

    return NextResponse.json({
      success: true,
      deleted_count: deleted?.length ?? 0,
    });
  } catch (err) {
    console.error("Import delete error:", err);
    return NextResponse.json(
      { error: "Neočekávaná chyba serveru" },
      { status: 500 }
    );
  }
}
