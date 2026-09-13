-- Additive migration. Run the preflight first on the connected project.
-- Existing profiles, transactions, dates and Auth users are never removed or rewritten.
begin;

do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.transactions') is null then
    raise exception 'Existing profiles and transactions tables are required. Inspect the target project first.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id' and udt_name='uuid')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='transactions' and column_name='user_id' and udt_name='uuid') then
    raise exception 'Unexpected ownership schema. Migration stopped without changes.';
  end if;
end $$;

alter table public.transactions add column if not exists source text not null default 'app';
alter table public.transactions add column if not exists created_at timestamptz not null default now();
alter table public.transactions add column if not exists archived_at timestamptz;
alter table public.transactions add column if not exists external_message_id text;
create index if not exists fc_transactions_user_date on public.transactions(user_id, date);
create unique index if not exists fc_transactions_external_message on public.transactions(user_id, source, external_message_id) where external_message_id is not null;

create table if not exists public.user_financial_profiles (
  user_id uuid primary key references auth.users(id),
  income_type text not null default 'Fixa',
  has_debts boolean not null default false,
  has_reserve boolean not null default false,
  fixed_expenses numeric(14,2) not null default 0 check (fixed_expenses >= 0),
  risk_profile text not null default 'Conservador' check (risk_profile in ('Conservador','Moderado','Arrojado')),
  investment_experience text not null default 'Iniciante',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 120),
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  category text not null default 'Personalizada',
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  message text not null,
  type text not null default 'info',
  read boolean not null default false,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique(user_id, dedupe_key)
);
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id),
  notifications_enabled boolean not null default true,
  plan text not null default 'FREE' check (plan in ('FREE','PRO','PREMIUM')),
  created_at timestamptz not null default now()
);
create index if not exists fc_goals_user on public.goals(user_id, created_at);
create index if not exists fc_notifications_user on public.notifications(user_id, created_at desc);

-- Restrictive policies also constrain any existing permissive policies.
do $$
declare tbl text; owner_column text;
begin
  foreach tbl in array array['profiles','transactions','goals','notifications','user_financial_profiles','user_preferences'] loop
    owner_column := case when tbl='profiles' then 'id' else 'user_id' end;
    execute format('alter table public.%I enable row level security', tbl);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname='fc_owner_guard') then
      execute format('create policy fc_owner_guard on public.%I as restrictive for all to public using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)', tbl, owner_column, owner_column);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname='fc_owner_access') then
      execute format('create policy fc_owner_access on public.%I for all to authenticated using ((select auth.uid()) = %I) with check ((select auth.uid()) = %I)', tbl, owner_column, owner_column);
    end if;
    execute format('grant select, insert, update on public.%I to authenticated', tbl);
  end loop;
end $$;

-- Never trust a client-controlled plan for billing/entitlements.
create or replace function public.fc_protect_plan() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    if (tg_op='INSERT' and new.plan <> 'FREE') or (tg_op='UPDATE' and new.plan is distinct from old.plan) then
      raise exception 'Plan changes require a trusted billing backend';
    end if;
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='fc_plan_guard' and tgrelid='public.user_preferences'::regclass) then
    create trigger fc_plan_guard before insert or update on public.user_preferences for each row execute function public.fc_protect_plan();
  end if;
end $$;

-- Existing legacy DD/MM/YYYY dates remain untouched. New writes must use ISO.
create or replace function public.fc_validate_transaction() returns trigger
language plpgsql set search_path = '' as $$
declare parsed date;
begin
  if tg_op='INSERT' or new.date is distinct from old.date then
    if new.date::text !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use YYYY-MM-DD for transaction dates'; end if;
    parsed := new.date::text::date;
    if to_char(parsed, 'YYYY-MM-DD') <> new.date::text then raise exception 'Invalid transaction date'; end if;
  end if;
  if tg_op='INSERT' or new.amount is distinct from old.amount then
    if new.amount::numeric <= 0 or new.amount::numeric > 999999999 then raise exception 'Invalid transaction amount'; end if;
  end if;
  if tg_op='INSERT' or new.type is distinct from old.type then
    if new.type not in ('income','expense') then raise exception 'Invalid transaction type'; end if;
  end if;
  if new.source not in ('app','whatsapp','import','automation') then raise exception 'Invalid transaction source'; end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='fc_transaction_validation' and tgrelid='public.transactions'::regclass) then
    create trigger fc_transaction_validation before insert or update on public.transactions for each row execute function public.fc_validate_transaction();
  end if;
end $$;
commit;
