import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const migration = fs.readFileSync(
  'supabase/migrations/202609100001_financerto_rebuild.sql',
  'utf8',
)
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222'
test('additive migration preserves legacy rows, isolates users and protects plans', async () => {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to public;
    insert into auth.users values ('${a}'),('${b}');
    create table profiles(id uuid primary key references auth.users(id), nome text, email text, occupation text, monthly_income numeric, financial_goal text, criado_em timestamptz, atualizado_em timestamptz);
    create table transactions(id uuid primary key, user_id uuid references auth.users(id), type text, title text, category text, amount numeric, date text);
    insert into transactions values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${a}','income','Legado','Salário',100,'31/08/2026'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${b}','expense','Outro usuário','Outros',20,'2026-08-31');
    alter table transactions enable row level security; create policy old_permissive on transactions for all to public using(true) with check(true);
    grant select on transactions to anon;`)
  await db.exec(migration)
  await db.exec(migration)
  const compatibility = fs.readFileSync(
    'supabase/migrations/202609100002_remote_compatibility.sql',
    'utf8',
  )
  await db.exec(compatibility)
  await db.exec(compatibility)
  assert.equal(
    (await db.query('select count(*)::int as n from transactions')).rows[0].n,
    2,
  )
  assert.equal(
    (await db.query("select date from transactions where title='Legado'"))
      .rows[0].date,
    '31/08/2026',
  )
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`,
  )
  assert.equal(
    (await db.query('select count(*)::int as n from transactions')).rows[0].n,
    1,
  )
  await assert.rejects(() =>
    db.exec(
      `insert into goals(user_id,title,target_amount) values('${b}','Ataque',100)`,
    ),
  )
  await db.exec(
    `insert into goals(user_id,title,target_amount) values('${a}','Reserva',100)`,
  )
  await db.exec(`insert into user_preferences(user_id) values('${a}')`)
  await assert.rejects(() =>
    db.exec(`update user_preferences set plan='PREMIUM' where user_id='${a}'`),
  )
  await db.exec(
    `update user_preferences set notifications_enabled=false where user_id='${a}'`,
  )
  await assert.rejects(() =>
    db.exec(
      `insert into transactions(id,user_id,type,title,amount,date) values(gen_random_uuid(),'${a}','expense','Bad',20,'31/02/2026')`,
    ),
  )
  await db.exec(
    `insert into transactions(id,user_id,type,title,amount,date) values(gen_random_uuid(),'${a}','expense','Novo',20,'2026-09-10')`,
  )
  await db.exec(
    `update transactions set archived_at=now() where title='Legado'`,
  )
  assert.equal(
    (await db.query("select date from transactions where title='Legado'"))
      .rows[0].date,
    '31/08/2026',
  )
  await db.exec(
    `reset role; set role anon; select set_config('request.jwt.claim.sub','',false);`,
  )
  assert.equal(
    (await db.query('select count(*)::int as n from transactions')).rows[0].n,
    0,
  )
  await db.close()
})
