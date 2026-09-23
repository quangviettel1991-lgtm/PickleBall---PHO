// Read-only: never import the application or execute its synchronization code.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/)
  .filter(line => /^[A-Z_][A-Z0-9_]*=/.test(line))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !env.VITE_CLUB_ID) throw new Error('Missing explicit database configuration');
const url = new URL('/rest/v1/pickleball_club', env.VITE_SUPABASE_URL);
url.searchParams.set('id', `eq.${env.VITE_CLUB_ID}`);
url.searchParams.set('select', '*');
const response = await fetch(url, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }, signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`Read-only backup failed: HTTP ${response.status}`);
const raw = await response.text();
const rows = JSON.parse(raw);
if (rows.length !== 1 || !rows[0].data || !Array.isArray(rows[0].data.members)) throw new Error('Unexpected backup shape; no file accepted as a valid backup');
const dir = resolve('backups', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, 'remote-row.json'), raw, { flag: 'wx' });
const reread = await readFile(resolve(dir, 'remote-row.json'), 'utf8');
if (reread !== raw) throw new Error('Backup verification failed');
const digest = createHash('sha256').update(raw).digest('hex');
const manifest = { createdAt: new Date().toISOString(), clubId: env.VITE_CLUB_ID, sha256: digest, bytes: Buffer.byteLength(raw), counts: Object.fromEntries(['members','events','matches','transactions'].map(k=>[k,rows[0].data[k]?.length??0])) };
await writeFile(resolve(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ directory: dir, ...manifest }));
