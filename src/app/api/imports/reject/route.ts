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
    const { import_id } = body;

    if (!import_id) {
      return NextResponse.json(
        { error: "Chybí import_id" },
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

    // 4. Update status to rejected
    const { error: updateError } = await admin
      .from("document_imports")
      .update({ status: "rejected" })
      .eq("id", import_id);

    if (updateError) {
      console.error("Import reject error:", updateError);
      return NextResponse.json(
        { error: "Chyba při zamítání importu" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Import reject error:", err);
    return NextResponse.json(
      { error: "Neočekávaná chyba serveru" },
      { status: 500 }
    );
  }
}
