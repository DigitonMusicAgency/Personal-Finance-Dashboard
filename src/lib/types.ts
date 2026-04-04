export type JournalType = "standard" | "cashflow";

export type TransactionType =
  | "income"
  | "expense"
  | "internal_transfer"
  | "repayment"
  | "manual_adjustment";

export type TransactionSource =
  | "import_pdf"
  | "import_csv"
  | "manual"
  | "non_monetary";

export type ImportSourceType = "airbank_pdf" | "wise_csv" | "wise_pdf";

export type ImportStatus =
  | "processing"
  | "review"
  | "confirmed"
  | "rejected"
  | "failed";

export interface Journal {
  id: string;
  user_id: string;
  name: string;
  type: JournalType;
  counterparty_name: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  journal_id: string;
  name: string;
  bank_service: string;
  account_number: string | null;
  currency: string;
  opening_balance: number;
  opening_balance_date: string | null;
  note: string | null;
  is_own_account: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  journal_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string | null;
  journal_id: string;
  date: string;
  amount: number;
  currency: string;
  amount_czk: number;
  exchange_rate: number;
  type: TransactionType;
  description: string | null;
  counterparty: string | null;
  category_id: string | null;
  note: string | null;
  source: TransactionSource;
  document_import_id: string | null;
  variable_symbol: string | null;
  original_amount: number | null;
  original_currency: string | null;
  external_id: string | null;
  is_confirmed: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category;
  account?: Account;
}

export interface DocumentImport {
  id: string;
  journal_id: string;
  account_id: string;
  file_name: string;
  file_path: string;
  source_type: ImportSourceType;
  status: ImportStatus;
  raw_ai_response: unknown;
  error_message: string | null;
  transaction_count: number | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface CategorizationRule {
  id: string;
  journal_id: string;
  match_field: "counterparty" | "description";
  match_value: string;
  category_id: string;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  currency: string;
  date: string;
  rate_to_czk: number;
  source: string;
  created_at: string;
}
