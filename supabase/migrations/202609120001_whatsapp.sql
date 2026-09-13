-- Additive WhatsApp infrastructure. No existing financial rows are modified.
begin;
create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id),
  phone_e164 text, wa_id text unique, verified boolean not null default false,
  verified_at timestamptz, status text not null default 'disconnected' check(status in ('active','disconnected')),
  version uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(wa_id is null or wa_id ~ '^[1-9][0-9]{7,14}$'),
  check(status <> 'active' or (verified and wa_id is not null and verified_at is not null))
);
create table if not exists public.whatsapp_link_codes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'), expires_at timestamptz not null,
  used_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists fc_wa_codes_user on public.whatsapp_link_codes(user_id,created_at);
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(), provider_message_id text not null unique,
  user_id uuid references auth.users(id), wa_id text not null check(wa_id ~ '^[1-9][0-9]{7,14}$'),
  connection_id uuid references public.whatsapp_connections(id), connection_version uuid,
  direction text not null default 'inbound' check(direction in ('inbound','outbound')),
  message_type text not null default 'text', intent text, status text not null default 'queued',
  payload_text text, link_hash text, sent_at timestamptz not null, created_at timestamptz not null default now(),
  processed_at timestamptz, attempts int not null default 0, lease uuid, lease_until timestamptz,
  next_attempt_at timestamptz not null default now(), transaction_id uuid references public.transactions(id),
  response_text text, delivery_status text not null default 'none', delivery_attempts int not null default 0,
  delivery_lease uuid, delivery_lease_until timestamptz, delivery_next_at timestamptz not null default now(),
  outbound_message_id text, last_error text,
  check(length(provider_message_id) between 1 and 300), check(payload_text is null or length(payload_text)<=1000)
);
create index if not exists fc_wa_messages_queue on public.whatsapp_messages(status,next_attempt_at);
create index if not exists fc_wa_messages_delivery on public.whatsapp_messages(delivery_status,delivery_next_at);
create index if not exists fc_wa_messages_sender on public.whatsapp_messages(wa_id,created_at);
create table if not exists public.whatsapp_contexts (
  user_id uuid primary key references auth.users(id), connection_id uuid not null references public.whatsapp_connections(id),
  connection_version uuid not null, wa_id text not null, pending jsonb, expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_rate_limits (
  key text primary key, window_start timestamptz not null, count int not null
);
do $$ declare tbl text; begin
  foreach tbl in array array['whatsapp_connections','whatsapp_link_codes','whatsapp_messages','whatsapp_contexts','whatsapp_rate_limits'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon,authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
  end loop;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='whatsapp_connections' and policyname='fc_wa_read_own_connection') then
    create policy fc_wa_read_own_connection on public.whatsapp_connections for select to authenticated using(user_id=(select auth.uid()));
  end if;
end $$;
grant select on public.whatsapp_connections to authenticated;

create or replace function public.fc_wa_rate(p_key text,p_limit int,p_seconds int) returns boolean
language plpgsql security definer set search_path='' as $$ declare n int; begin
  insert into public.whatsapp_rate_limits as r(key,window_start,count) values(p_key,now(),1)
  on conflict(key) do update set
    count=case when r.window_start < now()-make_interval(secs=>p_seconds) then 1 else r.count+1 end,
    window_start=case when r.window_start < now()-make_interval(secs=>p_seconds) then now() else r.window_start end
  returning count into n;
  return n<=p_limit;
end $$;

create or replace function public.fc_wa_issue_code(p_hash text) returns timestamptz
language plpgsql security definer set search_path='' as $$ declare uid uuid:=auth.uid(); expiry timestamptz:=now()+interval '10 minutes'; begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('wa-user:'||uid::text,0));
  if not public.fc_wa_rate('link:'||uid::text,5,900) then raise exception 'Aguarde antes de gerar outro código.'; end if;
  if exists(select 1 from public.whatsapp_connections where user_id=uid and status='active') then raise exception 'Desconecte o número atual antes de vincular outro.'; end if;
  update public.whatsapp_link_codes set revoked_at=now() where user_id=uid and used_at is null and revoked_at is null;
  insert into public.whatsapp_link_codes(user_id,code_hash,expires_at) values(uid,p_hash,expiry);
  return expiry;
end $$;

create or replace function public.fc_wa_disconnect() returns void
language plpgsql security definer set search_path='' as $$ declare uid uuid:=auth.uid(); begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('wa-user:'||uid::text,0));
  update public.whatsapp_connections set status='disconnected',verified=false,wa_id=null,version=gen_random_uuid(),updated_at=now() where user_id=uid;
  update public.whatsapp_link_codes set revoked_at=now() where user_id=uid and used_at is null and revoked_at is null;
  update public.whatsapp_contexts set pending=null,expires_at=now() where user_id=uid;
  update public.whatsapp_messages set delivery_status='cancelled',response_text=null where user_id=uid and delivery_status in ('pending','sending');
end $$;

create or replace function public.fc_wa_enqueue(p_provider_id text,p_wa_id text,p_text text,p_link_hash text,p_sent_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$ declare mid uuid; conn public.whatsapp_connections; begin
  select id into mid from public.whatsapp_messages where provider_message_id=p_provider_id;
  if found then return jsonb_build_object('id',mid,'duplicate',true); end if;
  if p_wa_id !~ '^[1-9][0-9]{7,14}$' or length(p_provider_id)>300 or length(coalesce(p_text,''))>1000 then raise exception 'Invalid envelope'; end if;
  if p_sent_at<now()-interval '24 hours' or p_sent_at>now()+interval '5 minutes' then return jsonb_build_object('ignored',true); end if;
  if not public.fc_wa_rate('inbound:'||p_wa_id,20,60) then return jsonb_build_object('limited',true); end if;
  select * into conn from public.whatsapp_connections where wa_id=p_wa_id and status='active' and verified;
  insert into public.whatsapp_messages(provider_message_id,wa_id,payload_text,link_hash,sent_at,user_id,connection_id,connection_version)
  values(p_provider_id,p_wa_id,case when p_link_hash is null then p_text else null end,p_link_hash,p_sent_at,conn.user_id,conn.id,conn.version)
  on conflict(provider_message_id) do nothing returning id into mid;
  if mid is null then select id into mid from public.whatsapp_messages where provider_message_id=p_provider_id; end if;
  return jsonb_build_object('id',mid);
end $$;

create or replace function public.fc_wa_claim(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; begin
  select * into msg from public.whatsapp_messages where id=p_id for update skip locked;
  if not found or msg.status not in ('queued','processing') or msg.attempts>=5 or msg.next_attempt_at>now() then return null; end if;
  if msg.status='processing' and msg.lease_until>now() then return null; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('wa-sender:'||msg.wa_id,0)) then return null; end if;
  if exists(select 1 from public.whatsapp_messages where wa_id=msg.wa_id and id<>msg.id and status='processing' and lease_until>now()) then return null; end if;
  if exists(select 1 from public.whatsapp_messages where wa_id=msg.wa_id and id<>msg.id and status='queued' and created_at<msg.created_at and attempts<5) then return null; end if;
  update public.whatsapp_messages set status='processing',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=p_id returning * into msg;
  return to_jsonb(msg);
end $$;

create or replace function public.fc_wa_link(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; code public.whatsapp_link_codes; conn public.whatsapp_connections; begin
  select * into msg from public.whatsapp_messages where id=p_id and lease=p_lease and status='processing' for update;
  if not found then raise exception 'Invalid processing lease'; end if;
  select * into code from public.whatsapp_link_codes where code_hash=msg.link_hash for update;
  if not found or code.used_at is not null or code.revoked_at is not null or code.expires_at<=now() then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('wa-user:'||code.user_id::text,0));
  if exists(select 1 from public.whatsapp_connections where (wa_id=msg.wa_id or user_id=code.user_id) and status='active') then return false; end if;
  begin
    insert into public.whatsapp_connections(user_id,phone_e164,wa_id,verified,verified_at,status)
    values(code.user_id,'+'||msg.wa_id,msg.wa_id,true,now(),'active')
    on conflict(user_id) do update set phone_e164=excluded.phone_e164,wa_id=excluded.wa_id,verified=true,verified_at=now(),status='active',version=gen_random_uuid(),updated_at=now()
    returning * into conn;
  exception when unique_violation then return false; end;
  update public.whatsapp_link_codes set used_at=now() where id=code.id;
  update public.whatsapp_messages set user_id=conn.user_id,connection_id=conn.id,connection_version=conn.version where id=msg.id;
  return true;
end $$;

create or replace function public.fc_wa_snapshot(p_id uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; conn public.whatsapp_connections; result jsonb; begin
  select * into msg from public.whatsapp_messages where id=p_id and lease=p_lease and status='processing';
  if not found then raise exception 'Invalid processing lease'; end if;
  select * into conn from public.whatsapp_connections where id=msg.connection_id and version=msg.connection_version and user_id=msg.user_id and wa_id=msg.wa_id and verified and status='active';
  if not found then return jsonb_build_object('authorized',false); end if;
  select jsonb_build_object('authorized',true,'userId',conn.user_id,
    'transactions',coalesce((select jsonb_agg(to_jsonb(t) order by t.date desc,t.id) from public.transactions t where t.user_id=conn.user_id and t.archived_at is null),'[]'::jsonb),
    'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.goals g where g.user_id=conn.user_id and g.archived_at is null),'[]'::jsonb),
    'profile',coalesce((select to_jsonb(p) from public.profiles p where p.id=conn.user_id),'{}'::jsonb)||coalesce((select to_jsonb(f) from public.user_financial_profiles f where f.user_id=conn.user_id),'{}'::jsonb),
    'context',(select c.pending from public.whatsapp_contexts c where c.user_id=conn.user_id and c.wa_id=conn.wa_id and c.connection_version=conn.version and c.expires_at>now())
  ) into result;
  return result;
end $$;

create or replace function public.fc_wa_create_transaction(p_id uuid,p_lease uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; conn public.whatsapp_connections; tx public.transactions; begin
  select * into msg from public.whatsapp_messages where id=p_id and lease=p_lease and status='processing' for update;
  if not found then raise exception 'Invalid processing lease'; end if;
  select * into conn from public.whatsapp_connections where id=msg.connection_id and version=msg.connection_version and user_id=msg.user_id and wa_id=msg.wa_id and verified and status='active' for update;
  if not found then raise exception 'WhatsApp disconnected' using errcode='42501'; end if;
  if msg.transaction_id is not null then select * into tx from public.transactions where id=msg.transaction_id and user_id=conn.user_id; return to_jsonb(tx); end if;
  if p_data->>'type' not in ('income','expense') or coalesce(length(trim(p_data->>'title')),0)=0 then raise exception 'Invalid transaction'; end if;
  insert into public.transactions(user_id,type,title,category,amount,date,source,external_message_id)
  values(conn.user_id,p_data->>'type',left(trim(p_data->>'title'),160),coalesce(p_data->>'category','Outros'),(p_data->>'amount')::numeric,(p_data->>'date')::date,'whatsapp',msg.provider_message_id)
  on conflict(user_id,source,external_message_id) where external_message_id is not null do nothing returning * into tx;
  if tx.id is null then select * into tx from public.transactions where user_id=conn.user_id and source='whatsapp' and external_message_id=msg.provider_message_id; end if;
  update public.whatsapp_messages set transaction_id=tx.id where id=msg.id;
  return to_jsonb(tx);
end $$;

create or replace function public.fc_wa_finish(p_id uuid,p_lease uuid,p_response text,p_intent text,p_context jsonb default null) returns void
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; conn public.whatsapp_connections; begin
  select * into msg from public.whatsapp_messages where id=p_id and lease=p_lease and status='processing' for update;
  if not found then raise exception 'Invalid processing lease'; end if;
  if msg.user_id is not null then
    select * into conn from public.whatsapp_connections where id=msg.connection_id and version=msg.connection_version and wa_id=msg.wa_id and user_id=msg.user_id and status='active' and verified for update;
    if not found then
      update public.whatsapp_messages set status='ignored',payload_text=null,link_hash=null,response_text=null,delivery_status='cancelled',processed_at=now() where id=p_id;
      return;
    end if;
    insert into public.whatsapp_contexts(user_id,connection_id,connection_version,wa_id,pending,expires_at)
    values(conn.user_id,conn.id,conn.version,conn.wa_id,p_context,now()+interval '10 minutes')
    on conflict(user_id) do update set connection_id=excluded.connection_id,connection_version=excluded.connection_version,wa_id=excluded.wa_id,pending=excluded.pending,expires_at=excluded.expires_at,updated_at=now();
  end if;
  update public.whatsapp_messages set status='processed',processed_at=now(),intent=left(p_intent,60),payload_text=null,link_hash=null,response_text=left(p_response,3500),delivery_status='pending',lease_until=null where id=p_id;
end $$;

create or replace function public.fc_wa_fail(p_id uuid,p_lease uuid,p_error text) returns void
language plpgsql security definer set search_path='' as $$ begin
  update public.whatsapp_messages set status=case when attempts>=5 then 'failed' else 'queued' end,
    next_attempt_at=now()+make_interval(secs=>least(600,15*(2^attempts)::int)),lease_until=null,last_error=left(p_error,60),
    payload_text=case when attempts>=5 then null else payload_text end,
    response_text=case when attempts>=5 then 'Não consegui concluir agora. Tente novamente em alguns instantes.' else null end,
    delivery_status=case when attempts>=5 then 'pending' else 'none' end
  where id=p_id and lease=p_lease and status='processing';
end $$;

create or replace function public.fc_wa_claim_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; begin
  select * into msg from public.whatsapp_messages where id=p_id for update skip locked;
  if not found or msg.delivery_status not in ('pending','sending') or msg.delivery_next_at>now() or msg.delivery_attempts>=8 then return null; end if;
  if msg.delivery_status='sending' and msg.delivery_lease_until>now() then return null; end if;
  if msg.sent_at<now()-interval '23 hours' or (msg.user_id is not null and not exists(select 1 from public.whatsapp_connections where id=msg.connection_id and version=msg.connection_version and wa_id=msg.wa_id and user_id=msg.user_id and verified and status='active')) then
    update public.whatsapp_messages set delivery_status='cancelled',response_text=null where id=p_id; return null;
  end if;
  update public.whatsapp_messages set delivery_status='sending',delivery_attempts=delivery_attempts+1,delivery_lease=gen_random_uuid(),delivery_lease_until=now()+interval '60 seconds' where id=p_id returning * into msg;
  return jsonb_build_object('id',msg.id,'waId',msg.wa_id,'text',msg.response_text,'lease',msg.delivery_lease);
end $$;

create or replace function public.fc_wa_delivery_result(p_id uuid,p_lease uuid,p_success boolean,p_provider_id text default null,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$ begin
  update public.whatsapp_messages set delivery_status=case when p_success then 'sent' when delivery_attempts>=8 then 'failed' else 'pending' end,
    response_text=case when p_success or delivery_attempts>=8 then null else response_text end,
    outbound_message_id=case when p_success then left(p_provider_id,300) else outbound_message_id end,
    delivery_next_at=now()+make_interval(secs=>least(1800,15*(2^delivery_attempts)::int)),
    delivery_lease_until=null,last_error=case when p_success then null else left(p_error,60) end
  where id=p_id and delivery_lease=p_lease and delivery_status='sending';
end $$;

create or replace function public.fc_wa_expire() returns void
language plpgsql security definer set search_path='' as $$ begin
  update public.whatsapp_contexts set pending=null where expires_at<now() and pending is not null;
  update public.whatsapp_messages set payload_text=null,link_hash=null,response_text=null,status=case when status in ('queued','processing') then 'expired' else status end,delivery_status=case when delivery_status in ('pending','sending') then 'expired' else delivery_status end
  where sent_at<now()-interval '24 hours' and (payload_text is not null or response_text is not null or link_hash is not null);
end $$;

-- All privileged functions are inaccessible to frontend users.
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'fc_wa_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant execute on function public.fc_wa_issue_code(text),public.fc_wa_disconnect() to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='transactions') then
    alter publication supabase_realtime add table public.transactions;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
