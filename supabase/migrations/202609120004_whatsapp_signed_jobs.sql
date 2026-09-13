begin;
-- Managed pg_net grants are owned by supabase_admin and may not be revocable by postgres.
-- Never place a reusable credential in its transient queue: sign a short-lived job instead.
create or replace function public.fc_wa_worker_tick() returns void
language plpgsql security definer set search_path='' as $$ declare token text; stamp text; signature text; begin
 select decrypted_secret into token from vault.decrypted_secrets where name='financerto_whatsapp_worker';
 if token is null then return; end if;
 stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
 signature:=encode(extensions.hmac(convert_to('financerto-worker:'||stamp,'UTF8'),convert_to(token,'UTF8'),'sha256'),'hex');
 perform net.http_post(url:='https://fzqstnkrklgficdurqsd.supabase.co/functions/v1/whatsapp-worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-worker-timestamp',stamp,'x-worker-signature',signature),body:='{}'::jsonb,timeout_milliseconds:=15000);
end $$;
create or replace function public.fc_wa_claim_tick(p_stamp int) returns boolean
language plpgsql security definer set search_path='' as $$ declare accepted boolean; begin
 if abs(extract(epoch from now())-p_stamp)>90 then return false; end if;
 insert into public.whatsapp_rate_limits as r(key,window_start,count) values('worker-last-tick',now(),p_stamp)
 on conflict(key) do update set count=excluded.count,window_start=now() where r.count<excluded.count returning true into accepted;
 return coalesce(accepted,false);
end $$;
revoke all on function public.fc_wa_claim_tick(int),public.fc_wa_worker_tick() from public,anon,authenticated;
grant execute on function public.fc_wa_claim_tick(int),public.fc_wa_worker_tick() to service_role;
commit;
