begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function public.fc_wa_worker_tick() returns void
language plpgsql security definer set search_path='' as $$ declare token text; begin
 select decrypted_secret into token from vault.decrypted_secrets where name='financerto_whatsapp_worker';
 if token is null then return; end if;
 perform net.http_post(url:='https://fzqstnkrklgficdurqsd.supabase.co/functions/v1/whatsapp-worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',token),body:='{}'::jsonb,timeout_milliseconds:=15000);
end $$;
revoke all on function public.fc_wa_worker_tick() from public,anon,authenticated;
grant execute on function public.fc_wa_worker_tick() to service_role;
do $$ begin
 if not exists(select 1 from cron.job where jobname='financerto-whatsapp-retry') then
 perform cron.schedule('financerto-whatsapp-retry','* * * * *','select public.fc_wa_worker_tick()');
 end if;
end $$;
commit;
