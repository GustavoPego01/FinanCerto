begin;
create or replace function public.fc_wa_link(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; code public.whatsapp_link_codes; conn public.whatsapp_connections; begin
  select * into msg from public.whatsapp_messages where id=p_id and lease=p_lease and status='processing' for update;
  if not found then raise exception 'Invalid processing lease'; end if;
  -- A retry of the same inbox record after a committed link remains successful.
  if msg.user_id is not null and exists(select 1 from public.whatsapp_link_codes where code_hash=msg.link_hash and used_at is not null and user_id=msg.user_id) and exists(select 1 from public.whatsapp_connections where id=msg.connection_id and version=msg.connection_version and wa_id=msg.wa_id and status='active' and verified) then return true; end if;
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
revoke all on function public.fc_wa_link(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fc_wa_link(uuid,uuid) to service_role;
commit;
