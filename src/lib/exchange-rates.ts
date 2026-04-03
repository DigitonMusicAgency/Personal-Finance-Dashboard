import { createAdminClient } from "@/lib/supabase/admin";

interface ExchangeRateResult {
  rate: number;
  date: string;
  source: string;
}

/**
 * Parse CNB daily exchange rate text response.
 * Format: pipe-delimited rows like "Austrálie|dolar|1|AUD|14,685"
 * First two lines are header (date + column names).
 */
function parseCnbResponse(
  text: string,
  currencyCode: string
): number | null {
  const lines = text.trim().split("\n");

  // Skip the first two header lines
  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].split("|");
    if (parts.length < 5) continue;

    const code = parts[3].trim();
    const quantity = parseFloat(parts[2].trim());
    const rateRaw = parts[4].trim().replace(",", ".");

    if (code.toUpperCase() === currencyCode.toUpperCase()) {
      const rate = parseFloat(rateRaw);
      if (isNaN(rate) || isNaN(quantity) || quantity === 0) return null;
      // CNB gives rate per `quantity` units, so rate for 1 unit = rate / quantity
      return rate / quantity;
    }
  }

  return null;
}

/**
 * Format a YYYY-MM-DD date string to DD.MM.YYYY for the CNB API.
 */
function formatDateForCnb(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Fetch the exchange rate from CNB for a given currency and date.
 * Falls back to the latest rate if the specific date returns no data.
 */
async function fetchFromCnb(
  currencyCode: string,
  dateStr: string
): Promise<{ rate: number; date: string } | null> {
  const cnbDate = formatDateForCnb(dateStr);
  const url = `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=${cnbDate}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const text = await response.text();
  const rate = parseCnbResponse(text, currencyCode);

  if (rate !== null) {
    return { rate, date: dateStr };
  }

  // Fallback: fetch the latest rate (no date param)
  const fallbackUrl =
    "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt";
  const fallbackResponse = await fetch(fallbackUrl);
  if (!fallbackResponse.ok) return null;

  const fallbackText = await fallbackResponse.text();
  const fallbackRate = parseCnbResponse(fallbackText, currencyCode);

  if (fallbackRate !== null) {
    // Extract the date from the first line of the CNB response (e.g. "01.04.2026 #64")
    const firstLine = fallbackText.trim().split("\n")[0];
    const dateMatch = firstLine.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    const actualDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      : dateStr;

    return { rate: fallbackRate, date: actualDate };
  }

  return null;
}

/**
 * Get the exchange rate for a currency to CZK on a given date.
 * Checks the Supabase cache first, then fetches from CNB and caches the result.
 *
 * @param currencyCode - ISO 4217 currency code (e.g. "EUR", "USD")
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Exchange rate result or null if not found
 */
export async function getExchangeRate(
  currencyCode: string,
  dateStr: string
): Promise<ExchangeRateResult | null> {
  const code = currencyCode.toUpperCase();

  // CZK to CZK is always 1
  if (code === "CZK") {
    return { rate: 1.0, date: dateStr, source: "identity" };
  }

  const admin = createAdminClient();

  // 1. Check cache
  const { data: cached } = await admin
    .from("exchange_rates")
    .select("rate_to_czk, date, source")
    .eq("currency", code)
    .eq("date", dateStr)
    .single();

  if (cached) {
    return {
      rate: Number(cached.rate_to_czk),
      date: cached.date,
      source: cached.source,
    };
  }

  // 2. Fetch from CNB
  const result = await fetchFromCnb(code, dateStr);
  if (!result) return null;

  // 3. Cache the result (upsert in case of race conditions)
  const { error: insertError } = await admin
    .from("exchange_rates")
    .upsert(
      {
        currency: code,
        date: dateStr,
        rate_to_czk: result.rate,
        source: "cnb",
      },
      { onConflict: "currency,date" }
    );

  if (insertError) {
    console.error("Failed to cache exchange rate:", insertError);
    // Still return the rate even if caching fails
  }

  return { rate: result.rate, date: result.date, source: "cnb" };
}
