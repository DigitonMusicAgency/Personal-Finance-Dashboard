import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRate } from "@/lib/exchange-rates";

export async function GET(request: NextRequest) {
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

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency");
    const date = searchParams.get("date");

    if (!currency) {
      return NextResponse.json(
        { error: "Chybí parametr 'currency'" },
        { status: 400 }
      );
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Chybí nebo neplatný parametr 'date' (očekávaný formát: YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // 3. Get the exchange rate (cached or fetched from CNB)
    const result = await getExchangeRate(currency, date);

    if (!result) {
      return NextResponse.json(
        { error: `Kurz pro ${currency.toUpperCase()} nebyl nalezen` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      rate: result.rate,
      date: result.date,
      source: result.source,
    });
  } catch (err) {
    console.error("Exchange rate API error:", err);
    return NextResponse.json(
      { error: "Neočekávaná chyba serveru" },
      { status: 500 }
    );
  }
}
