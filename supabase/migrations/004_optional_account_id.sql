-- Make account_id optional on transactions (for cashflow journals without bank accounts)
ALTER TABLE public.transactions
  ALTER COLUMN account_id DROP NOT NULL;

-- Make account_id optional on document_imports too
ALTER TABLE public.document_imports
  ALTER COLUMN account_id DROP NOT NULL;
