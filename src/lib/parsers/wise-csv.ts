export interface ParsedTransaction {
  date: string;
  amount: number;
  currency: string;
  amount_czk: number;
  exchange_rate: number;
  type: "income" | "expense" | "internal_transfer";
  description: string;
  counterparty: string;
  category_id: string | null;
  source: "import_csv" | "import_pdf";
  external_id: string;
  original_amount: number | null;
  original_currency: string | null;
  note: string | null;
  _is_fee: boolean;
}

/**
 * Parse a CSV line handling quoted fields (RFC 4180).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ",") {
        fields.push(current);
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Convert DD-MM-YYYY to YYYY-MM-DD
 */
function parseWiseDate(dateStr: string): string {
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return dateStr;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Determine transaction type from Wise CSV fields.
 */
function mapTransactionType(
  txType: string,
  detailsType: string
): "income" | "expense" | "internal_transfer" {
  const t = txType.trim().toUpperCase();
  const d = detailsType.trim().toUpperCase();

  if (t === "CREDIT" && d === "MONEY_ADDED") return "internal_transfer";
  if (t === "DEBIT") return "expense";
  return "income";
}

/**
 * Parse a Wise CSV file content into an array of ParsedTransactions.
 */
export function parseWiseCsv(csvContent: string): ParsedTransaction[] {
  const lines = csvContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  // Need at least header + 1 data row
  if (lines.length < 2) return [];

  // Skip header line (index 0)
  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 22) continue;

    const transferWiseId = fields[0].trim();
    const dateRaw = fields[1].trim();
    const amountRaw = fields[3].trim();
    const currency = fields[4].trim();
    const description = fields[5].trim();
    const payerName = fields[11].trim();
    const payeeName = fields[12].trim();
    const merchant = fields[14].trim();
    const noteField = fields[18]?.trim() || "";
    const exchangeTo = fields[9]?.trim() || "";
    const exchangeToAmountRaw = fields[20]?.trim() || "";
    const txType = fields[21]?.trim() || "";
    const detailsType = fields[22]?.trim() || "";

    const amount = parseFloat(amountRaw);
    if (isNaN(amount)) continue;

    const date = parseWiseDate(dateRaw);
    const isFee = transferWiseId.startsWith("FEE-");

    // Determine counterparty
    let counterparty = "";
    if (merchant) {
      counterparty = merchant;
    } else if (payerName) {
      counterparty = payerName;
    } else if (payeeName) {
      counterparty = payeeName;
    } else {
      counterparty = description.slice(0, 100);
    }

    // Original foreign amount
    const exchangeToAmount = parseFloat(exchangeToAmountRaw);
    const originalAmount =
      !isNaN(exchangeToAmount) && exchangeToAmount > 0
        ? exchangeToAmount
        : null;
    const originalCurrency =
      originalAmount && exchangeTo ? exchangeTo : null;

    const type = mapTransactionType(txType, detailsType);

    results.push({
      date,
      amount,
      currency,
      amount_czk: 0, // Filled by caller
      exchange_rate: 0, // Filled by caller
      type,
      description,
      counterparty,
      category_id: null,
      source: "import_csv",
      external_id: transferWiseId,
      original_amount: originalAmount,
      original_currency: originalCurrency,
      note: noteField || null,
      _is_fee: isFee,
    });
  }

  return results;
}
