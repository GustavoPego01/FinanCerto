begin;
-- pg_net defaults expose its transient request headers. Keep them server-only.
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
revoke usage on schema net from public, anon, authenticated;
grant usage on schema net to service_role;
commit;
