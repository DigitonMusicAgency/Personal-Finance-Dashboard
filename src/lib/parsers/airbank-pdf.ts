import type { ParsedTransaction } from "./wise-csv";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const EXTRACTION_PROMPT = `You are parsing a Czech bank statement PDF. The bank may be Air Bank, Fio banka, ČSOB, Komerční banka, Raiffeisenbank, or any other Czech bank.

Extract every transaction from the statement and return a JSON array. Each element must have these fields:

- "date": the posting date (datum zaúčtování / datum) in YYYY-MM-DD format
- "amount": a signed number (negative for expenses/outgoing, positive for income/incoming)
- "currency": the currency code (e.g. "CZK", "EUR", "USD"). Default to "CZK" if not specified.
- "type": "income" if amount > 0, "expense" if amount < 0
- "description": the transaction description / note / message for recipient
- "counterparty": see rules below
- "counterparty_account": the counterparty's bank account number if available (e.g. "1234567890/0800" or IBAN), otherwise null
- "variable_symbol": if a variable symbol (VS or Variabilní symbol) is present, extract it as a string; otherwise null

Counterparty rules:
- For card payments (kartou, karetní transakce): the counterparty is the MERCHANT NAME, NOT the cardholder name.
- For transfers (převod, příchozí platba, odchozí platba): the counterparty is the Name (Název / Jméno) of the sender or recipient.
- If no clear counterparty can be identified, use the description.

Respond with ONLY a valid JSON array. No markdown fencing, no explanation, no extra text. Just the raw JSON array.`;

interface GeminiTransaction {
  date: string;
  amount: number;
  currency: string;
  type: "income" | "expense";
  description: string;
  counterparty: string;
  counterparty_account: string | null;
  variable_symbol: string | null;
}

/**
 * Parse Air Bank PDF text using Gemini API.
 */
export async function parseAirBankPdf(
  pdfText: string,
  geminiApiKey: string
): Promise<ParsedTransaction[]> {
  const prompt = `${EXTRACTION_PROMPT}\n\nHere is the bank statement text:\n\n${pdfText}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = await response.json();

  // Gemini 2.5 may return multiple parts (thinking + text). Find the text part.
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const rawText: string | undefined = parts
    .map((p: { text?: string }) => p.text || "")
    .join("\n");

  if (!rawText?.trim()) {
    throw new Error(
      "Gemini API returned an empty or unexpected response structure."
    );
  }

  // Extract JSON array — find first [ and last ] in the response.
  // This handles markdown fencing, thinking blocks, and any wrapper text.
  const bracketStart = rawText.indexOf("[");
  const bracketEnd = rawText.lastIndexOf("]");
  const jsonStr = bracketStart !== -1 && bracketEnd > bracketStart
    ? rawText.slice(bracketStart, bracketEnd + 1)
    : rawText;

  let parsed: GeminiTransaction[];
  try {
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    throw new Error(
      `Gemini returned invalid JSON. Raw response:\n${rawText.slice(0, 1000)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Gemini response is not a JSON array. Got: " + typeof parsed
    );
  }

  return parsed.map((tx, idx) => ({
    date: tx.date,
    amount: tx.amount,
    currency: tx.currency || "CZK",
    amount_czk: tx.amount, // Already in CZK
    exchange_rate: 1,
    type: tx.type === "income" ? "income" : "expense",
    description: tx.description || "",
    counterparty: tx.counterparty || "",
    category_id: null,
    source: "import_pdf" as const,
    external_id: `airbank-${tx.date}-${idx}-${Math.abs(tx.amount)}`,
    original_amount: null,
    original_currency: null,
    note: tx.variable_symbol ? `VS: ${tx.variable_symbol}` : null,
    _is_fee: false,
  }));
}

/**
 * Parse Air Bank PDF by sending the raw PDF bytes to Gemini as inline_data.
 * This avoids needing a separate PDF text extraction step.
 */
export async function parseAirBankPdfFromBytes(
  pdfBase64: string,
  geminiApiKey: string
): Promise<ParsedTransaction[]> {
  const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = await response.json();

  // Check if response was truncated
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini response was truncated (too many transactions). Try splitting the PDF into smaller date ranges."
    );
  }

  // Gemini 2.5 may return multiple parts (thinking + text). Find the text part.
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const rawText: string | undefined = parts
    .map((p: { text?: string }) => p.text || "")
    .join("\n");

  if (!rawText?.trim()) {
    throw new Error(
      "Gemini API returned an empty or unexpected response structure."
    );
  }

  // Extract JSON array — find first [ and last ] in the response.
  const bracketStart2 = rawText.indexOf("[");
  const bracketEnd2 = rawText.lastIndexOf("]");
  const jsonStr = bracketStart2 !== -1 && bracketEnd2 > bracketStart2
    ? rawText.slice(bracketStart2, bracketEnd2 + 1)
    : rawText;

  let parsed: GeminiTransaction[];
  try {
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    throw new Error(
      `Gemini returned invalid JSON. Raw response:\n${rawText.slice(0, 1000)}`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Gemini response is not a JSON array. Got: " + typeof parsed
    );
  }

  return parsed.map((tx, idx) => ({
    date: tx.date,
    amount: tx.amount,
    currency: tx.currency || "CZK",
    amount_czk: tx.amount,
    exchange_rate: 1,
    type: tx.type === "income" ? "income" : "expense",
    description: tx.description || "",
    counterparty: tx.counterparty || "",
    category_id: null,
    source: "import_pdf" as const,
    external_id: `airbank-${tx.date}-${idx}-${Math.abs(tx.amount)}`,
    original_amount: null,
    original_currency: null,
    note: tx.variable_symbol ? `VS: ${tx.variable_symbol}` : null,
    _is_fee: false,
  }));
}
