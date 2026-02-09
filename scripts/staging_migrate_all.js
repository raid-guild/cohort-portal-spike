#!/usr/bin/env node
/**
 * Apply all SQL migrations in supabase/migrations/*.sql to STAGING_DATABASE_URL.
 * Runs each file in its own transaction.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dns = require('dns').promises;

function listMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && f !== '.keep')
    .sort()
    .map((f) => path.join(dir, f));
}

(async () => {
  const stagingUrl = process.env.STAGING_DATABASE_URL;
  const prodUrl = process.env.DATABASE_URL;

  if (!stagingUrl) {
    console.error('ERROR: STAGING_DATABASE_URL is not set');
    process.exit(1);
  }
  if (prodUrl && stagingUrl === prodUrl) {
    console.error('ERROR: STAGING_DATABASE_URL equals DATABASE_URL; refusing to run');
    process.exit(1);
  }

  const migrationsDir = path.resolve(__dirname, '..', 'supabase', 'migrations');
  const files = listMigrations(migrationsDir);

  if (!files.length) {
    console.log('No migration files found in', migrationsDir);
    process.exit(0);
  }

  // Force IPv4: this runtime lacks IPv6 egress, and Supabase hostnames often resolve AAAA first.
  const u = new URL(stagingUrl);
  const origHost = u.hostname;
  let ipv4 = null;
  try {
    const res = await dns.lookup(origHost, { family: 4 });
    ipv4 = res && res.address;
  } catch {}

  const client = new Client({
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: (u.pathname || '/').replace(/^\//, '') || 'postgres',
    port: u.port ? Number(u.port) : 5432,
    host: ipv4 || origHost,
    statement_timeout: 0,
    ssl: { rejectUnauthorized: false, servername: origHost },
  });

  try {
    await client.connect();

    // sanity: print connected db/user/host
    const who = await client.query('select current_database() as db, current_user as usr, inet_server_addr()::text as host, inet_server_port() as port');
    console.log('Connected:', who.rows[0]);

    // Create a simple migrations ledger
    await client.query(`
      create table if not exists public._openclaw_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const already = await client.query('select filename from public._openclaw_migrations');
    const applied = new Set(already.rows.map((r) => r.filename));

    let ran = 0;
    for (const file of files) {
      const filename = path.basename(file);
      if (applied.has(filename)) {
        console.log('SKIP', filename);
        continue;
      }

      const sql = fs.readFileSync(file, 'utf8');
      console.log('RUN ', filename);

      await client.query('begin');
      try {
        // Postgres can execute multiple statements in a single query string.
        await client.query(sql);
        await client.query('insert into public._openclaw_migrations(filename) values ($1)', [filename]);
        await client.query('commit');
        ran++;
      } catch (err) {
        await client.query('rollback');
        console.error('FAILED', filename);
        console.error(err && (err.stack || err.message || err));
        process.exitCode = 1;
        break;
      }
    }

    console.log(`Done. Newly applied: ${ran}. Total files: ${files.length}.`);
  } catch (err) {
    console.error('ERROR: migration runner failed');
    console.error(err && (err.stack || err.message || err));
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
})();
