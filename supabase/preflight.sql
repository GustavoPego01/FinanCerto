-- Read-only: inspect before applying migrations against an existing project.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name in ('profiles','transactions','goals','notifications','user_financial_profiles','user_preferences')
order by table_name, ordinal_position;
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public';
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r';
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated');
