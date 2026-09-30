-- Additive transport metadata. Existing inbox entries belong to Meta.
begin;
alter table public.whatsapp_messages add column if not exists provider text not null default 'meta'
  check(provider in ('meta','waha'));
create index if not exists fc_wa_provider_queue on public.whatsapp_messages(provider,status,next_attempt_at);
create table if not exists public.whatsapp_provider_health (
  provider text primary key check(provider in ('meta','waha')),
  last_webhook_at timestamptz,
  session_attempts int not null default 0,
  session_next_at timestamptz not null default now()
);
alter table public.whatsapp_provider_health enable row level security;
revoke all on public.whatsapp_provider_health from public,anon,authenticated;
grant all on public.whatsapp_provider_health to service_role;

create or replace function public.fc_wa_enqueue_provider(p_provider text,p_provider_id text,p_wa_id text,p_text text,p_link_hash text,p_sent_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
  if p_provider not in ('waha','meta') or p_provider is null then raise exception 'Invalid provider'; end if;
  if p_provider='waha' and p_provider_id not like 'waha:%' then raise exception 'Invalid provider identity'; end if;
  if p_provider='meta' and p_provider_id like 'waha:%' then raise exception 'Invalid provider identity'; end if;
  result:=public.fc_wa_enqueue(p_provider_id,p_wa_id,p_text,p_link_hash,p_sent_at);
  if result->>'id' is not null and not coalesce((result->>'duplicate')::boolean,false) then
    update public.whatsapp_messages set provider=p_provider where id=(result->>'id')::uuid;
  end if;
  return result;
end $$;

create or replace function public.fc_wa_webhook_seen(p_provider text) returns void
language sql security definer set search_path='' as $$
  insert into public.whatsapp_provider_health(provider,last_webhook_at) values(p_provider,now())
  on conflict(provider) do update set last_webhook_at=excluded.last_webhook_at;
$$;

-- Durable administrative cooldown, shared by every Edge isolate. Six attempts maximum.
create or replace function public.fc_wa_session_claim() returns boolean
language plpgsql security definer set search_path='' as $$ declare accepted boolean; begin
  insert into public.whatsapp_provider_health(provider) values('waha') on conflict do nothing;
  update public.whatsapp_provider_health set session_attempts=session_attempts+1,
    session_next_at=now()+make_interval(secs=>least(3600,30*(2^session_attempts)::int))
  where provider='waha' and session_attempts<6 and session_next_at<=now() returning true into accepted;
  return coalesce(accepted,false);
end $$;
create or replace function public.fc_wa_session_healthy() returns void
language sql security definer set search_path='' as $$
  update public.whatsapp_provider_health set session_attempts=0,session_next_at=now() where provider='waha';
$$;

revoke all on function public.fc_wa_enqueue_provider(text,text,text,text,text,timestamptz),public.fc_wa_webhook_seen(text),public.fc_wa_session_claim(),public.fc_wa_session_healthy() from public,anon,authenticated;
grant execute on function public.fc_wa_enqueue_provider(text,text,text,text,text,timestamptz),public.fc_wa_webhook_seen(text),public.fc_wa_session_claim(),public.fc_wa_session_healthy() to service_role;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='whatsapp_connections') then
    alter publication supabase_realtime add table public.whatsapp_connections;
  end if;
end $$;
create or replace function public.fc_wa_claim_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; begin
  select * into msg from public.whatsapp_messages where id=p_id for update skip locked;
  if not found or msg.delivery_status not in ('pending','sending') or msg.delivery_next_at>now() or msg.delivery_attempts>=8 then return null; end if;
  if msg.delivery_status='sending' and msg.delivery_lease_until>now() then return null; end if;
  if msg.sent_at<now()-interval '23 hours' or (msg.user_id is not null and not exists(select 1 from public.whatsapp_connections where id=msg.connection_id and version=msg.connection_version and wa_id=msg.wa_id and user_id=msg.user_id and verified and status='active')) then
    update public.whatsapp_messages set delivery_status='cancelled',response_text=null where id=p_id; return null;
  end if;
  if not public.fc_wa_rate('outbound-global',30,60) or not public.fc_wa_rate('outbound:'||msg.wa_id,10,60) then return null; end if;
  update public.whatsapp_messages set delivery_status='sending',delivery_attempts=delivery_attempts+1,delivery_lease=gen_random_uuid(),delivery_lease_until=now()+interval '60 seconds' where id=p_id returning * into msg;
  return jsonb_build_object('id',msg.id,'waId',msg.wa_id,'text',msg.response_text,'lease',msg.delivery_lease);
end $$;


create or replace function public.fc_wa_claim(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; begin
  select * into msg from public.whatsapp_messages where id=p_id for update skip locked;
  if not found or msg.status not in ('queued','processing') or msg.attempts>=5 or msg.next_attempt_at>now() then return null; end if;
  if msg.status='processing' and msg.lease_until>now() then return null; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('wa-sender:'||msg.wa_id,0)) then return null; end if;
  if exists(select 1 from public.whatsapp_messages where wa_id=msg.wa_id and provider=msg.provider and id<>msg.id and status='processing' and lease_until>now()) then return null; end if;
  if exists(select 1 from public.whatsapp_messages where wa_id=msg.wa_id and provider=msg.provider and id<>msg.id and status='queued' and created_at<msg.created_at and attempts<5) then return null; end if;
  update public.whatsapp_messages set status='processing',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=p_id returning * into msg;
  return to_jsonb(msg);
end $$;


notify pgrst,'reload schema';
commit;
