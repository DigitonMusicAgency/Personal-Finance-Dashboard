import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWiseCsv } from "@/lib/parsers/wise-csv";

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

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const journalId = formData.get("journal_id") as string | null;
    const accountId = formData.get("account_id") as string | null;

    if (!file || !journalId || !accountId) {
      return NextResponse.json(
        { error: "Chybí soubor, deník nebo účet" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 3. Verify journal ownership
    const { data: journal } = await admin
      .from("journals")
      .select("id")
      .eq("id", journalId)
      .eq("user_id", user.id)
      .single();

    if (!journal) {
      return NextResponse.json(
        { error: "Deník nenalezen" },
        { status: 404 }
      );
    }

    // 4. Detect file type and parse
    const fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      return NextResponse.json(
        { error: "PDF import bude dostupný brzy" },
        { status: 400 }
      );
    }

    if (ext !== "csv") {
      return NextResponse.json(
        { error: "Nepodporovaný formát souboru. Použijte CSV nebo PDF." },
        { status: 400 }
      );
    }

    // 5. Read and parse CSV
    const content = await file.text();
    const transactions = parseWiseCsv(content);

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "Soubor neobsahuje žádné transakce" },
        { status: 400 }
      );
    }

    // 6. Create document_imports record
    const { data: importRecord, error: importError } = await admin
      .from("document_imports")
      .insert({
        journal_id: journalId,
        account_id: accountId,
        file_name: fileName,
        file_path: `imports/${journalId}/${fileName}`,
        source_type: "wise_csv",
        status: "review",
        transaction_count: transactions.length,
      })
      .select("id")
      .single();

    if (importError) {
      console.error("Import record creation failed:", importError);
      return NextResponse.json(
        { error: "Chyba při vytváření záznamu importu" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        import_id: importRecord.id,
        transactions,
        file_name: fileName,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Import upload error:", err);
    return NextResponse.json(
      { error: "Neočekávaná chyba serveru" },
      { status: 500 }
    );
  }
}
