-- ============================================================================
-- Finanční Deník — Initial Database Schema
-- ============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================================
-- JOURNALS
-- ============================================================================
create table public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('standard', 'cashflow')),
  counterparty_name text,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.journals enable row level security;
create policy "Users manage own journals" on public.journals
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- ACCOUNTS
-- ============================================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  name text not null,
  bank_service text not null,
  currency text not null default 'CZK',
  opening_balance numeric(15,2) not null default 0,
  opening_balance_date date,
  note text,
  is_own_account boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
create policy "Users manage own accounts" on public.accounts
  for all using (
    journal_id in (select id from public.journals where user_id = auth.uid())
  );

-- ============================================================================
-- CATEGORIES
-- ============================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  name text not null,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
create policy "Users manage own categories" on public.categories
  for all using (
    journal_id in (select id from public.journals where user_id = auth.uid())
  );

-- ============================================================================
-- CATEGORIZATION RULES
-- ============================================================================
create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  match_field text not null check (match_field in ('counterparty', 'description')),
  match_value text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (journal_id, match_field, match_value)
);

alter table public.categorization_rules enable row level security;
create policy "Users manage own rules" on public.categorization_rules
  for all using (
    journal_id in (select id from public.journals where user_id = auth.uid())
  );

-- ============================================================================
-- DOCUMENT IMPORTS
-- ============================================================================
create table public.document_imports (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  source_type text not null check (source_type in ('airbank_pdf', 'wise_csv', 'wise_pdf')),
  status text not null default 'processing' check (status in ('processing', 'review', 'confirmed', 'rejected', 'failed')),
  raw_ai_response jsonb,
  error_message text,
  transaction_count integer,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.document_imports enable row level security;
create policy "Users manage own imports" on public.document_imports
  for all using (
    journal_id in (select id from public.journals where user_id = auth.uid())
  );

-- ============================================================================
-- TRANSACTIONS
-- ============================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  journal_id uuid not null references public.journals(id) on delete cascade,
  date date not null,
  amount numeric(15,2) not null,
  currency text not null default 'CZK',
  amount_czk numeric(15,2) not null,
  exchange_rate numeric(10,6) not null default 1.0,
  type text not null check (type in ('income', 'expense', 'internal_transfer', 'repayment', 'manual_adjustment')),
  description text,
  counterparty text,
  category_id uuid references public.categories(id) on delete set null,
  note text,
  source text not null check (source in ('import_pdf', 'import_csv', 'manual', 'non_monetary')),
  document_import_id uuid references public.document_imports(id) on delete set null,
  variable_symbol text,
  original_amount numeric(15,2),
  original_currency text,
  external_id text,
  is_confirmed boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "Users manage own transactions" on public.transactions
  for all using (
    journal_id in (select id from public.journals where user_id = auth.uid())
  );

-- Index for fast journal-based queries
create index idx_transactions_journal_date on public.transactions(journal_id, date desc);
create index idx_transactions_account on public.transactions(account_id);
create index idx_transactions_external_id on public.transactions(external_id) where external_id is not null;

-- ============================================================================
-- EXCHANGE RATES
-- ============================================================================
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null,
  date date not null,
  rate_to_czk numeric(10,6) not null,
  source text not null default 'cnb',
  created_at timestamptz not null default now(),
  unique (currency, date)
);

alter table public.exchange_rates enable row level security;
-- Exchange rates are shared/public data, readable by any authenticated user
create policy "Authenticated users can read rates" on public.exchange_rates
  for select using (auth.uid() is not null);
create policy "Authenticated users can insert rates" on public.exchange_rates
  for insert with check (auth.uid() is not null);

-- ============================================================================
-- FUNCTIONS: Auto-update updated_at
-- ============================================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger journals_updated_at before update on public.journals
  for each row execute function public.update_updated_at();

create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.update_updated_at();

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.update_updated_at();

-- ============================================================================
-- FUNCTION: Seed default categories for a new journal
-- ============================================================================
create or replace function public.seed_journal_categories()
returns trigger as $$
begin
  insert into public.categories (journal_id, name, color, sort_order) values
    (new.id, 'Google Ads', '#4285F4', 1),
    (new.id, 'Meta Ads (Facebook)', '#1877F2', 2),
    (new.id, 'Software a nástroje', '#8B5CF6', 3),
    (new.id, 'Příjem z faktur', '#10B981', 4),
    (new.id, 'Nájem', '#F59E0B', 5),
    (new.id, 'Bankovní poplatky', '#6B7280', 6),
    (new.id, 'Převod', '#94A3B8', 7),
    (new.id, 'Splátka / vyrovnání', '#EC4899', 8),
    (new.id, 'Daně a odvody', '#EF4444', 9),
    (new.id, 'Cestování', '#06B6D4', 10),
    (new.id, 'Jídlo', '#F97316', 11),
    (new.id, 'Ostatní', '#78716C', 12);
  return new;
end;
$$ language plpgsql;

create trigger journal_seed_categories after insert on public.journals
  for each row execute function public.seed_journal_categories();
