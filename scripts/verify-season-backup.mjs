import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { parseBackup } from '../src/utils/schema.js';

const backupPath = process.argv[2];
if (!backupPath) throw new Error('Usage: npm run verify:season-backup -- <backup.json>');
const raw = await readFile(backupPath, 'utf8');
const old = parseBackup(raw, 1);
const pg = new PGlite();
try {
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.pickleball_club(id bigint primary key,data jsonb,updated_at timestamptz);
    insert into auth.users values('00000000-0000-0000-0000-000000000001','amaquangvp@gmail.com');`);
  await pg.query('insert into public.pickleball_club values(1,$1,now())', [old]);
  for (const file of [
    'supabase/migrations/202609230001_safe_club.sql',
    'supabase/migrations/202609290001_manager_role.sql',
    'supabase/provision-season-2027.sql',
    'supabase/migrations/202611220001_archive_2026.sql',
  ]) await pg.exec(await readFile(file, 'utf8'));
  const rows = (await pg.query('select id,data from public.pickleball_club order by id')).rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].data, old);
  assert.equal(rows[1].data.season, '2027');
  assert.deepEqual(rows[1].data.transactions, old.transactions);
  assert.deepEqual(rows[1].data.members.map(m => m.id), old.members.map(m => m.id));
  assert.deepEqual(rows[1].data.events, []);
  assert.deepEqual(rows[1].data.matches, []);
  assert.deepEqual(rows[1].data.draws, {});
  assert.ok(rows[1].data.members.every(m => m.eloSingles === 1000 && m.eloDoubles === 1200));
  await assert.rejects(() => pg.query('update public.pickleball_club set data=data where id=1'), /archived and read-only/);
  const sha256 = createHash('sha256').update(raw).digest('hex');
  console.log(JSON.stringify({ file: basename(backupPath), sha256, members: old.members.length,
    events: old.events.length, matches: old.matches.length, transactions: old.transactions.length,
    draws: Object.keys(old.draws).length, result: '2026 unchanged; 2027 provisioned; 2026 locked' }));
} finally {
  await pg.close();
}
