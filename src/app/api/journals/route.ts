import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Default categories seeded for every new journal
const DEFAULT_CATEGORIES = [
  { name: "Google Ads", color: "#4285F4", sort_order: 1 },
  { name: "Meta Ads (Facebook)", color: "#1877F2", sort_order: 2 },
  { name: "Software a nástroje", color: "#8B5CF6", sort_order: 3 },
  { name: "Příjem z faktur", color: "#10B981", sort_order: 4 },
  { name: "Nájem", color: "#F59E0B", sort_order: 5 },
  { name: "Bankovní poplatky", color: "#6B7280", sort_order: 6 },
  { name: "Převod", color: "#94A3B8", sort_order: 7 },
  { name: "Splátka / vyrovnání", color: "#EC4899", sort_order: 8 },
  { name: "Daně a odvody", color: "#EF4444", sort_order: 9 },
  { name: "Cestování", color: "#06B6D4", sort_order: 10 },
  { name: "Jídlo", color: "#F97316", sort_order: 11 },
  { name: "Ostatní", color: "#78716C", sort_order: 12 },
];

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the user is authenticated
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

    // 2. Parse request body
    const body = await request.json();
    const { name, type, sort_order } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Chybí název nebo typ deníku" },
        { status: 400 }
      );
    }

    // 3. Use admin client (service_role) to bypass RLS for the whole operation
    const admin = createAdminClient();

    // 3a. Create the journal
    const { data: journal, error: journalError } = await admin
      .from("journals")
      .insert({
        user_id: user.id,
        name: name.trim(),
        type,
        sort_order: sort_order ?? 0,
      })
      .select("id")
      .single();

    if (journalError) {
      console.error("Journal creation failed:", journalError);
      return NextResponse.json(
        { error: "Nepodařilo se vytvořit deník: " + journalError.message },
        { status: 500 }
      );
    }

    // 3b. Seed default categories for this journal
    // Note: The DB trigger "seed_journal_categories" may also fire.
    // Check if categories already exist (from the trigger) before inserting.
    const { data: existingCats } = await admin
      .from("categories")
      .select("id")
      .eq("journal_id", journal.id)
      .limit(1);

    if (!existingCats || existingCats.length === 0) {
      const categories = DEFAULT_CATEGORIES.map((cat) => ({
        ...cat,
        journal_id: journal.id,
      }));

      const { error: catError } = await admin
        .from("categories")
        .insert(categories);

      if (catError) {
        console.error("Category seeding failed:", catError);
        // Journal was created, categories failed — not critical, continue
      }
    }

    return NextResponse.json({ id: journal.id }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Neočekávaná chyba serveru" },
      { status: 500 }
    );
  }
}
