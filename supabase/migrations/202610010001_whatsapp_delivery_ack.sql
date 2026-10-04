-- Preserve inbox/financial history. An uncertain send must never be retried blindly.
begin;
alter table public.whatsapp_messages add column if not exists delivery_last_attempt_at timestamptz;
alter table public.whatsapp_messages add column if not exists delivered_at timestamptz;

create or replace function public.fc_wa_claim_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare msg public.whatsapp_messages; begin
  select * into msg from public.whatsapp_messages where id=p_id for update skip locked;
  if not found or msg.delivery_status not in ('pending','sending') then return null; end if;
  if msg.delivery_status='sending' then
    if msg.delivery_lease_until<=now() then
      update public.whatsapp_messages set delivery_status='unknown',last_error='DELIVERY_UNKNOWN',delivery_lease_until=null where id=p_id;
    end if;
    return null;
  end if;
  if msg.delivery_attempts>=3 then
    update public.whatsapp_messages set delivery_status='failed' where id=p_id;
    return null;
  end if;
  if msg.delivery_next_at>now() then return null; end if;
  if msg.status not in ('processed','failed') or msg.response_text is null or msg.sent_at<now()-interval '23 hours'
    or (msg.user_id is not null and not exists(select 1 from public.whatsapp_connections where id=msg.connection_id and version=msg.connection_version and wa_id=msg.wa_id and user_id=msg.user_id and verified and status='active')) then
    update public.whatsapp_messages set delivery_status='cancelled',response_text=null where id=p_id; return null;
  end if;
  if not public.fc_wa_rate('outbound-global',30,60) or not public.fc_wa_rate('outbound:'||msg.wa_id,10,60) then return null; end if;
  update public.whatsapp_messages set delivery_status='sending',delivery_attempts=delivery_attempts+1,
    delivery_last_attempt_at=now(),delivery_lease=gen_random_uuid(),delivery_lease_until=now()+interval '60 seconds'
    where id=p_id returning * into msg;
  return jsonb_build_object('id',msg.id,'waId',msg.wa_id,'text',msg.response_text,'lease',msg.delivery_lease);
end $$;

create or replace function public.fc_wa_delivery_result(p_id uuid,p_lease uuid,p_success boolean,p_provider_id text default null,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$ begin
  update public.whatsapp_messages set
    delivery_status=case when p_success then 'sent'
      when p_error='DELIVERY_RETRYABLE' and delivery_attempts<3 then 'pending'
      when p_error in ('DELIVERY_RETRYABLE','DELIVERY_REJECTED') then 'failed' else 'unknown' end,
    response_text=case when p_success then null else response_text end,
    outbound_message_id=case when p_success then left(p_provider_id,300) else outbound_message_id end,
    delivered_at=case when p_success then now() else delivered_at end,
    delivery_next_at=now()+make_interval(secs=>least(1800,30*(2^delivery_attempts)::int)),
    delivery_lease_until=null,last_error=case when p_success then null else left(p_error,60) end
    where id=p_id and delivery_lease=p_lease and delivery_status in ('sending','unknown');
end $$;

-- Legacy failed acknowledgements may already have reached WhatsApp. Preserve for audit.
update public.whatsapp_messages set delivery_status='unknown',last_error='DELIVERY_UNKNOWN'
where provider='waha' and delivery_status='pending' and delivery_attempts>0 and last_error='DELIVERY_FAILED';
notify pgrst,'reload schema';
commit;
