#!/usr/bin/env node
/**
 * Apply SQL migrations in supabase/migrations to a target Postgres database.
 *
 * Design goals:
 * - Idempotent: tracks applied migrations in a small table.
 * - Safe-ish: serializes runs via advisory lock.
 * - Minimal deps: uses `pg`.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node automation/migrate-db.mjs
 *
 * Optional env:
 *   MIGRATIONS_DIR=./supabase/migrations
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const DATABASE_URL = reqEnv("DATABASE_URL");
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(process.cwd(), "supabase", "migrations");

// Avoid coupling production schema to OpenClaw naming; this is just a migration ledger.
const MIGRATIONS_TABLE = "public._migrations";
const ADVISORY_LOCK_KEY = 918273645; // arbitrary constant for this repo

function needsNonTransactional(sql) {
  // Basic heuristic. Extend if needed.
  return /\bCONCURRENTLY\b/i.test(sql) || /\bCREATE\s+INDEX\s+CONCURRENTLY\b/i.test(sql);
}

async function listMigrationFiles() {
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists ${MIGRATIONS_TABLE} (
      name text primary key,
      applied_at timestamptz not null default now(),
      checksum text not null
    );
  `);
}

async function appliedSet(client) {
  const res = await client.query(`select name, checksum from ${MIGRATIONS_TABLE}`);
  const map = new Map();
  for (const r of res.rows) map.set(r.name, r.checksum);
  return map;
}

async function trackApplied(client, name, checksum) {
  // Write to the ledger in its own (short) transaction.
  await client.query("begin");
  try {
    await client.query(
      `insert into ${MIGRATIONS_TABLE} (name, checksum) values ($1, $2)
       on conflict (name) do nothing`,
      [name, checksum]
    );
    await client.query("commit");
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {}
    throw err;
  }
}

async function applyOne(client, name, sql, checksum) {
  const transactional = !needsNonTransactional(sql);

  if (transactional) await client.query("begin");
  try {
    await client.query(sql);

    if (transactional) {
      // Ledger write is within the same transaction for fully transactional migrations.
      await client.query(
        `insert into ${MIGRATIONS_TABLE} (name, checksum) values ($1, $2)
         on conflict (name) do nothing`,
        [name, checksum]
      );
      await client.query("commit");
      return;
    }

    // Non-transactional migrations (e.g. CREATE INDEX CONCURRENTLY) can't be wrapped.
    // Track them separately so we don't end up in an "applied but untracked" state.
    try {
      await trackApplied(client, name, checksum);
    } catch (trackErr) {
      // At this point, the SQL likely already ran successfully, so re-running can get stuck.
      // Provide a clear recovery path.
      throw new Error(
        `Migration ${name} executed but failed to record in ${MIGRATIONS_TABLE}. ` +
          `To unblock future runs, manually insert it, e.g.\n\n` +
          `  insert into ${MIGRATIONS_TABLE} (name, checksum) values ('${name}', '${checksum}')\n\n` +
          `Original error: ${String(trackErr?.message || trackErr)}`
      );
    }
  } catch (err) {
    if (transactional) {
      try {
        await client.query("rollback");
      } catch {}
    }
    throw err;
  }
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Serialize runs.
    await client.query("select pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);

    await ensureMigrationsTable(client);

    const files = await listMigrationFiles();
    const applied = await appliedSet(client);

    let appliedCount = 0;
    for (const file of files) {
      const full = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(full, "utf8");
      const checksum = (await import("node:crypto")).createHash("sha256").update(sql).digest("hex");

      if (applied.has(file)) {
        // Optional: detect drift
        const prev = applied.get(file);
        if (prev !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${file}. Applied checksum differs from current file. ` +
              `Do not edit applied migrations; create a new migration instead.`
          );
        }
        continue;
      }

      process.stdout.write(`Applying ${file}... `);
      await applyOne(client, file, sql, checksum);
      appliedCount += 1;
      process.stdout.write("ok\n");
    }

    console.log(`Done. Newly applied migrations: ${appliedCount}`);
    if (appliedCount === 0) console.log("No pending migrations.");
  } finally {
    try {
      await client.query("select pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    } catch {}
    await client.end();
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
