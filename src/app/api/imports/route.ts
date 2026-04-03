import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWiseCsv } from "@/lib/parsers/wise-csv";
import { parseAirBankPdfFromBytes } from "@/lib/parsers/airbank-pdf";

/**
 * Detect source type from filename.
 * For PDFs: "airbank_pdf" if filename contains "airbank" or "Air", else "wise_pdf".
 * For CSVs: "wise_csv".
 */
function detectSourceType(
  fileName: string,
  ext: string
): string {
  if (ext === "pdf") {
    const lower = fileName.toLowerCase();
    if (lower.includes("airbank") || fileName.includes("Air")) {
      return "airbank_pdf";
    }
    return "wise_pdf";
  }
  return "wise_csv";
}

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
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const sourceType = detectSourceType(fileName, ext);

    let transactions;

    if (ext === "pdf") {
      // PDF import via Gemini
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return NextResponse.json(
          { error: "Gemini API klíč není nakonfigurován na serveru" },
          { status: 500 }
        );
      }

      // Read PDF as base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfBase64 = buffer.toString("base64");

      transactions = await parseAirBankPdfFromBytes(pdfBase64, geminiApiKey);
    } else if (ext === "csv") {
      // CSV import (Wise)
      const content = await file.text();
      transactions = parseWiseCsv(content);
    } else {
      return NextResponse.json(
        { error: "Nepodporovaný formát souboru. Použijte CSV nebo PDF." },
        { status: 400 }
      );
    }

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
        source_type: sourceType,
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
