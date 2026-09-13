-- Reviewed against the existing FinanCerto schema. No existing rows are rewritten.
begin;
alter table public.transactions add column if not exists updated_at timestamptz default now();
alter table public.transactions alter column created_at set default now();
alter table public.transactions alter column updated_at set default now();
alter table public.profiles alter column criado_em set default now();
alter table public.profiles alter column atualizado_em set default now();
alter table public.goals add column if not exists archived_at timestamptz;
create index if not exists fc_goals_active_user on public.goals(user_id) where archived_at is null;

create or replace function public.fc_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name='profiles' then new.atualizado_em := now();
  else new.updated_at := now(); end if;
  return new;
end $$;
do $$ declare tbl text; begin
  foreach tbl in array array['profiles','transactions'] loop
    if not exists (select 1 from pg_trigger where tgname='fc_touch_updated_at' and tgrelid=format('public.%I',tbl)::regclass) then
      execute format('create trigger fc_touch_updated_at before update on public.%I for each row execute function public.fc_touch_updated_at()',tbl);
    end if;
  end loop;
end $$;

-- Reuse the existing Auth trigger, adding idempotence without changing user records.
create or replace function public.criar_perfil_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,nome,email)
  values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'nome'),''),'Usuário'),new.email)
  on conflict(id) do nothing;
  return new;
end $$;

-- RLS applies to physical DELETE too; the app uses archiving to preserve history.
grant delete on public.profiles, public.transactions, public.goals, public.notifications,
  public.user_preferences, public.user_financial_profiles to authenticated;
notify pgrst, 'reload schema';
commit;
