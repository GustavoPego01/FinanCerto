-- Read-only baseline: save results privately before/after deployment.
-- Fingerprints include archived rows; no raw personal/financial data is returned.
select 'auth.users' as relation, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) as fingerprint
from auth.users t
union all
select 'profiles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.profiles t
union all
select 'transactions',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.transactions t
union all
select 'goals',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.goals t
union all
select 'user_financial_profiles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id),'')) from public.user_financial_profiles t;

select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and (c.relname like 'whatsapp_%' or c.relname in ('transactions','profiles','goals')) and c.relkind='r';
select tablename from pg_publication_tables where pubname='supabase_realtime';
select status,delivery_status,count(*) from public.whatsapp_messages group by status,delivery_status;
