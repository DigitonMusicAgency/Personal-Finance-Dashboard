-- Add owner_name to journals for cashflow "your side" display name
ALTER TABLE public.journals ADD COLUMN owner_name text;
