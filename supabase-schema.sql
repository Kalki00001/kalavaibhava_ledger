-- Run this whole script in Supabase Dashboard -> SQL Editor.
-- Each signed-in user can read/write ONLY their own transactions.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('CREDIT', 'DEBIT')),
  description text not null check (char_length(trim(description)) between 1 and 100),
  amount numeric(12,2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('Cash', 'UPI')),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
on public.transactions for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
on public.transactions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
on public.transactions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
on public.transactions for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists transactions_user_date_idx
on public.transactions (user_id, transaction_date desc, created_at desc);

-- Optional hardening: prevent a browser from assigning transactions to another user.
-- user_id is omitted by the app and defaults to auth.uid().
