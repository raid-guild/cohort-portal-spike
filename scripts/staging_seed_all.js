#!/usr/bin/env node
/**
 * Apply all staging seed SQL files in supabase/seeds/staging/*.sql
 * to STAGING_DATABASE_URL.
 *
 * Each file runs in its own transaction.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function listSql(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
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

  const seedsDir = path.resolve(__dirname, '..', 'supabase', 'seeds', 'staging');
  if (!fs.existsSync(seedsDir)) {
    console.log('No staging seeds dir found at', seedsDir);
    process.exit(0);
  }

  const files = listSql(seedsDir);
  if (!files.length) {
    console.log('No staging seed SQL files found in', seedsDir);
    process.exit(0);
  }

  const client = new Client({ connectionString: stagingUrl, statement_timeout: 0, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    const who = await client.query('select current_database() as db, current_user as usr');
    console.log('Connected:', who.rows[0]);

    await client.query(`
      create table if not exists public._openclaw_seeds (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const already = await client.query('select filename from public._openclaw_seeds');
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
        await client.query(sql);
        await client.query('insert into public._openclaw_seeds(filename) values ($1)', [filename]);
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
    console.error('ERROR: seed runner failed');
    console.error(err && (err.stack || err.message || err));
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch (err) {
      console.warn("WARN: failed to close DB client");
      console.warn(err && (err.stack || err.message || err));
    }
  }
})();
