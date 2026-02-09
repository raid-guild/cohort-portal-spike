#!/usr/bin/env node
/**
 * Stage poller for raid-guild/cohort-portal-spike.
 *
 * Finds the newest PR labeled `ready-to-stage`, resets staging DB, applies SQL migrations + seed,
 * promotes PR by force-updating `staging` branch ref to PR head SHA, waits for Vercel readiness
 * via /api/health, runs smoke checks, then comments + updates labels.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// pg is added as a devDependency in this PR.
import pg from "pg";
const { Client } = pg;

const OWNER = "raid-guild";
const REPO = "cohort-portal-spike";
const READY_LABEL = "ready-to-stage";
const STAGED_LABEL = "staged";
const FAILED_LABEL = "staging-failed";

const STAGING_BRANCH = "staging";

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const GH_TOKEN = reqEnv("GH_TOKEN");
const STAGING_DATABASE_URL = reqEnv("STAGING_DATABASE_URL");
const STAGING_BASE_URL = reqEnv("STAGING_BASE_URL").replace(/\/$/, "");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const execFileAsync = promisify(execFile);

function pathsForRoot(root) {
  return {
    migrationsDir: path.join(root, "supabase", "migrations"),
    seedPath: path.join(root, "supabase", "seed.sql"),
    stagingSeedsDir: path.join(root, "supabase", "seeds", "staging"),
  };
}

async function gh(pathname, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API ${method} ${pathname} failed: ${res.status} ${res.statusText}\n${text}`);
  }
  // Some endpoints return 204
  if (res.status === 204) return null;
  return res.json();
}

async function listReadyPRs() {
  // Search issues API is easiest for labels.
  // Sort by updated desc so we stage the most recently updated PR.
  const q = `repo:${OWNER}/${REPO} is:pr is:open label:${READY_LABEL} sort:updated-desc`;
  const data = await gh(`/search/issues?q=${encodeURIComponent(q)}&per_page=5`);
  return data.items || [];
}

async function getPR(number) {
  return gh(`/repos/${OWNER}/${REPO}/pulls/${number}`);
}

async function addLabel(number, label) {
  return gh(`/repos/${OWNER}/${REPO}/issues/${number}/labels`, {
    method: "POST",
    body: { labels: [label] },
  });
}

async function removeLabel(number, label) {
  try {
    await gh(`/repos/${OWNER}/${REPO}/issues/${number}/labels/${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
  } catch (e) {
    // ignore if missing
  }
}

async function comment(number, body) {
  return gh(`/repos/${OWNER}/${REPO}/issues/${number}/comments`, {
    method: "POST",
    body: { body },
  });
}

async function forceUpdateBranch(branch, sha) {
  // Update Git ref
  return gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: { sha, force: true },
  });
}

async function acquireLock({ staleAfterMs = 30 * 60_000 } = {}) {
  const lockFile = path.join(repoRoot, ".stage.lock");
  const lockId = crypto.randomUUID();

  async function tryCreate() {
    const fh = await fs.open(lockFile, "wx");
    await fh.writeFile(`${lockId}\n${new Date().toISOString()}\n`);
    await fh.close();
    return async () => {
      // release
      try {
        const current = await fs.readFile(lockFile, "utf8").catch(() => "");
        if (current.startsWith(lockId)) await fs.unlink(lockFile);
      } catch {}
    };
  }

  try {
    return await tryCreate();
  } catch {
    // If lock exists, check staleness (e.g., prior run was killed).
    try {
      const stat = await fs.stat(lockFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > staleAfterMs) {
        await fs.unlink(lockFile).catch(() => {});
        return await tryCreate();
      }
    } catch {}
    return null;
  }
}

async function dbExecMany(sql) {
  const client = new Client({ connectionString: STAGING_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Nuke & pave: drop + recreate `public` schema.
 *
 * Also re-applies common Supabase role grants (best-effort) so anon/authenticated/service_role
 * can access objects after schema recreation.
 *
 * NOTE: This requires sufficient privileges on the database.
 */
async function resetDb() {
  const sql = `
    DO $$
    BEGIN
      -- terminate other connections (best effort)
      PERFORM pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid();
    EXCEPTION WHEN insufficient_privilege THEN
      -- ignore
      NULL;
    END $$;

    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;

    -- baseline schema usage
    GRANT USAGE ON SCHEMA public TO public;

    -- Supabase roles (best effort; ignore if roles don't exist)
    DO $$
    BEGIN
      EXECUTE 'GRANT USAGE ON SCHEMA public TO anon';
      EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
      EXECUTE 'GRANT USAGE ON SCHEMA public TO service_role';
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END $$;

    -- Grant table/sequence/function access so RLS policies can take effect.
    DO $$
    BEGIN
      EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated';
      EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated';
      EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role';
      EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role';
      EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role';

      -- Ensure future objects created by migrations inherit these defaults.
      EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated';
      EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated';
      EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role';
      EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role';
      EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role';
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END $$;
  `;

  await dbExecMany(sql);
}

async function applyMigrations(fromRoot) {
  const { migrationsDir } = pathsForRoot(fromRoot);
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const sql = await fs.readFile(full, "utf8");
    if (!sql.trim()) continue;
    await dbExecMany(sql);
  }
}

async function applySeed(fromRoot) {
  const { seedPath } = pathsForRoot(fromRoot);
  const sql = await fs.readFile(seedPath, "utf8").catch(() => "");
  if (sql.trim()) await dbExecMany(sql);
}

async function applyStagingSeeds(fromRoot) {
  const { stagingSeedsDir } = pathsForRoot(fromRoot);
  let files;
  try {
    files = (await fs.readdir(stagingSeedsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return; // no staging seeds
  }

  for (const file of files) {
    const full = path.join(stagingSeedsDir, file);
    const sql = await fs.readFile(full, "utf8");
    if (!sql.trim()) continue;
    await dbExecMany(sql);
  }
}

async function waitForHealthSha(
  expectedSha,
  { timeoutMs = 10 * 60_000, intervalMs = 8000 } = {}
) {
  const start = Date.now();
  const urlBase = STAGING_BASE_URL;
  let lastStatus = null;
  let lastSha = null;

  while (Date.now() - start < timeoutMs) {
    const t = Date.now();
    const url = `${urlBase}/api/health?t=${t}`;
    try {
      const res = await fetch(url, {
        headers: { "cache-control": "no-cache" },
        redirect: "follow",
      });
      lastStatus = res.status;

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const got = json?.git?.sha;
        lastSha = got || null;
        if (got && got.startsWith(expectedSha.slice(0, 7))) return { ok: true, got };
      }
    } catch {
      // ignore transient network errors
    }

    const elapsed = Math.floor((Date.now() - start) / 1000);
    console.log(
      `Waiting for staging deploy… ${elapsed}s elapsed (last /api/health status=${lastStatus}, sha=${lastSha || "n/a"})`
    );

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { ok: false, lastStatus, lastSha };
}

async function smokeTest() {
  // Minimal, fast checks. Expand later.
  const endpoints = [`/api/health?t=${Date.now()}`, `/api/modules?t=${Date.now()}`];

  for (const ep of endpoints) {
    const url = `${STAGING_BASE_URL}${ep}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Smoke check failed: GET ${ep} → ${res.status}`);
  }
}

function checklistText() {
  return [
    "## Manual staging checklist",
    "- [ ] Browse home page",
    "- [ ] `/people` directory loads",
    "- [ ] `/me` login flow works",
    "- [ ] Key modules render (announcements, cohort hub, billing if enabled)",
    "- [ ] No obvious console errors",
    "- [ ] If relevant: create/update profile and verify persists",
  ].join("\n");
}

function failureHint(errText) {
  // crude heuristics
  if (/permission|privilege|denied/i.test(errText)) {
    return "DB reset/migrations failed due to permissions. Confirm STAGING_DATABASE_URL has admin privileges (schema drop/create, migrations).";
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(errText)) {
    return "Network/URL issue. Confirm STAGING_BASE_URL is reachable and Vercel deployment completed.";
  }
  if (/syntax error/i.test(errText)) {
    return "SQL syntax error in a migration/seed file.";
  }
  return "Check the logs above; likely a migration/seed error or deploy not becoming ready.";
}

async function main() {
  const releaser = await acquireLock();
  if (!releaser) {
    console.log("Stage poller: lock held; skipping this run.");
    return;
  }

  let prNumber;
  let sha;
  let worktreeDir;

  try {
    const items = await listReadyPRs();
    if (!items.length) {
      console.log("No PRs labeled ready-to-stage.");
      return;
    }

    // Pick the newest updated PR.
    prNumber = items[0].number;
    const pr = await getPR(prNumber);
    sha = pr.head.sha;

    await comment(
      prNumber,
      `Staging pipeline starting for ${sha.slice(0, 7)} → ${STAGING_BASE_URL}\n\n(automation: reset DB → migrate/seed (+ staging fixtures) → promote to \`${STAGING_BRANCH}\` → wait for /api/health → smoke test)`
    );

    // Check out the PR's exact SHA in a detached worktree so migrations/seeds match the staged code.
    worktreeDir = path.join("/tmp", `cohort-portal-stage-${sha.slice(0, 12)}`);
    await fs.rm(worktreeDir, { recursive: true, force: true });
    await execFileAsync("git", ["-C", repoRoot, "worktree", "add", "--detach", worktreeDir, sha]);

    // DB reset + migrations + seeds (including staging fixtures from the PR code)
    await resetDb();
    await applyMigrations(worktreeDir);
    await applySeed(worktreeDir);
    await applyStagingSeeds(worktreeDir);

    // Promote by moving staging branch
    await forceUpdateBranch(STAGING_BRANCH, sha);

    // Wait for Vercel deploy to serve expected sha
    const health = await waitForHealthSha(sha);
    if (!health.ok) {
      throw new Error(
        `Timed out waiting for staging deploy to become ready at ${STAGING_BASE_URL}/api/health (expected sha ${sha}).`
      );
    }

    await smokeTest();

    await removeLabel(prNumber, READY_LABEL);
    await removeLabel(prNumber, FAILED_LABEL);
    await addLabel(prNumber, STAGED_LABEL);

    await comment(
      prNumber,
      `✅ Staged successfully.\n\n- **Staging URL:** ${STAGING_BASE_URL}\n- **Commit:** ${sha}\n\n${checklistText()}\n\nWhen finished, apply \`verified-on-staging\` or re-apply \`ready-to-stage\` after fixes.`
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack || ""}` : String(err);

    // Best effort: label/comment the same PR we started working on.
    if (prNumber) {
      try {
        await removeLabel(prNumber, READY_LABEL);
        await addLabel(prNumber, FAILED_LABEL);
        await comment(
          prNumber,
          `❌ Staging failed.\n\n**Error:**\n\n\`\`\`\n${msg.slice(0, 6500)}\n\`\`\`\n\n**Likely cause:** ${failureHint(msg)}\n\nFix and re-apply \`ready-to-stage\` to retry.`
        );
      } catch {}
    }

    console.error(msg);
    process.exitCode = 1;
  } finally {
    if (worktreeDir) {
      try {
        await execFileAsync("git", ["-C", repoRoot, "worktree", "remove", "--force", worktreeDir]);
      } catch {
        // ignore cleanup failures
      }
      await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
    }
    await releaser();
  }
}

main();
