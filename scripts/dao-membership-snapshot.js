#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const args = parseArgs(process.argv.slice(2));
const daoId = (args.dao || process.env.DAO_ID || "").toLowerCase();
const chainId = args.chain || process.env.DAO_CHAIN_ID || null;
const graphUrl = args.graph || process.env.DAO_GRAPH_URL || "";
const pageSize = Number(args.pageSize || process.env.DAO_PAGE_SIZE || 500);
const graphApiKey = args.graphApiKey || process.env.DAO_GRAPH_API_KEY || "";
const includeZeroPower = toBool(args.includeZeroPower ?? process.env.DAO_INCLUDE_ZERO_POWER);
const seedProfiles = toBool(args.seedProfiles ?? process.env.DAO_SEED_PROFILES);
const upsertMemberships = toBool(args.upsertMemberships ?? process.env.DAO_UPSERT_MEMBERSHIPS);
const syncEntitlements = toBool(args.syncEntitlements ?? process.env.DAO_SYNC_ENTITLEMENTS);
const deactivateMissing = toBool(args.deactivateMissing ?? process.env.DAO_DEACTIVATE_MISSING);

if (!daoId || !isAddress(daoId)) {
  console.error("Missing or invalid DAO address. Provide --dao or DAO_ID.");
  process.exit(1);
}

if (!graphUrl) {
  console.error("Missing DAO graph endpoint. Provide --graph or DAO_GRAPH_URL.");
  process.exit(1);
}

if (!Number.isInteger(pageSize) || pageSize <= 0) {
  console.error("Invalid page size. Use --pageSize <positive integer>.");
  process.exit(1);
}

const outputArg = args.output || process.env.DAO_SNAPSHOT_OUTPUT || "";
const outputPath = outputArg || defaultSnapshotPath(daoId);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const startedAt = new Date().toISOString();
  const fetchResult = await fetchMembersSnapshot({
    graphUrl,
    graphApiKey,
    daoId,
    pageSize,
    includeZeroPower,
  });

  const snapshot = {
    meta: {
      snapshot_at: startedAt,
      dao_id: daoId,
      chain_id: chainId,
      source: {
        kind: "subgraph",
        graph_url: graphUrl,
        query_template: fetchResult.queryTemplate,
      },
      include_zero_power: includeZeroPower,
      total_rows: fetchResult.totalRows,
      total_members: fetchResult.members.length,
    },
    members: fetchResult.members,
  };

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`Wrote snapshot: ${outputPath}`);
  console.log(`Members: ${fetchResult.members.length} (rows scanned: ${fetchResult.totalRows})`);

  const needsSupabase = seedProfiles || upsertMemberships || syncEntitlements || deactivateMissing;
  if (!needsSupabase) return;

  if (!chainId) {
    console.error("Missing chain id. Provide --chain or DAO_CHAIN_ID for Supabase sync modes.");
    process.exit(1);
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for --seedProfiles/--upsertMemberships modes.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  if (upsertMemberships || syncEntitlements || deactivateMissing) {
    await upsertDaoMemberships({
      supabase,
      daoId,
      chainId,
      graphUrl,
      members: fetchResult.members,
      deactivateMissing,
      syncEntitlements,
    });
  }

  if (!seedProfiles) return;

  await seedClaimableProfiles({
    supabase,
    members: fetchResult.members,
  });
}

async function fetchMembersSnapshot({
  graphUrl,
  graphApiKey,
  daoId,
  pageSize,
  includeZeroPower,
}) {
  const queryTemplates = [
    {
      name: "members.dao",
      query: `
        query SnapshotMembers($dao: String!, $first: Int!, $lastId: String!) {
          members(
            where: { dao: $dao, id_gt: $lastId }
            first: $first
            orderBy: id
            orderDirection: asc
          ) {
            id
            memberAddress
            shares
            loot
            createdAt
          }
        }
      `,
      pickRows: (json) => json?.data?.members,
    },
    {
      name: "members.moloch",
      query: `
        query SnapshotMembers($dao: String!, $first: Int!, $lastId: String!) {
          members(
            where: { moloch: $dao, id_gt: $lastId }
            first: $first
            orderBy: id
            orderDirection: asc
          ) {
            id
            memberAddress
            shares
            loot
            createdAt
          }
        }
      `,
      pickRows: (json) => json?.data?.members,
    },
    {
      name: "members.dao_nested",
      query: `
        query SnapshotMembers($dao: String!, $first: Int!, $lastId: String!) {
          members(
            where: { dao_: { id: $dao }, id_gt: $lastId }
            first: $first
            orderBy: id
            orderDirection: asc
          ) {
            id
            memberAddress
            shares
            loot
            createdAt
          }
        }
      `,
      pickRows: (json) => json?.data?.members,
    },
    {
      name: "members.dao_minimal",
      query: `
        query SnapshotMembers($dao: String!, $first: Int!, $lastId: String!) {
          members(
            where: { dao: $dao, id_gt: $lastId }
            first: $first
            orderBy: id
            orderDirection: asc
          ) {
            id
            shares
            loot
          }
        }
      `,
      pickRows: (json) => json?.data?.members,
    },
    {
      name: "members.moloch_minimal",
      query: `
        query SnapshotMembers($dao: String!, $first: Int!, $lastId: String!) {
          members(
            where: { moloch: $dao, id_gt: $lastId }
            first: $first
            orderBy: id
            orderDirection: asc
          ) {
            id
            shares
            loot
          }
        }
      `,
      pickRows: (json) => json?.data?.members,
    },
    {
      name: "members.dao_nested_minimal",
      query: `
        query SnapshotMembers($dao: String!, $first: Int!, $lastId: String!) {
          members(
            where: { dao_: { id: $dao }, id_gt: $lastId }
            first: $first
            orderBy: id
            orderDirection: asc
          ) {
            id
            shares
            loot
          }
        }
      `,
      pickRows: (json) => json?.data?.members,
    },
  ];

  let lastError = null;
  const templateErrors = [];
  for (const template of queryTemplates) {
    try {
      const result = await fetchWithTemplate({
        graphUrl,
        graphApiKey,
        daoId,
        pageSize,
        includeZeroPower,
        template,
      });
      return {
        ...result,
        queryTemplate: template.name,
      };
    } catch (error) {
      lastError = error;
      templateErrors.push({
        template: template.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Unknown GraphQL error.";
  if (templateErrors.length) {
    console.error("Template attempts:");
    templateErrors.forEach((entry) => {
      console.error(`- ${entry.template}: ${entry.message}`);
    });
  }
  throw new Error(
    `Failed to fetch members from graph endpoint with known query templates. ${message}`,
  );
}

async function fetchWithTemplate({
  graphUrl,
  graphApiKey,
  daoId,
  pageSize,
  includeZeroPower,
  template,
}) {
  let lastId = "";
  let totalRows = 0;
  const dedup = new Map();

  while (true) {
    const json = await graphRequest({
      graphUrl,
      graphApiKey,
      query: template.query,
      variables: {
        dao: daoId,
        first: pageSize,
        lastId,
      },
    });

    if (json?.errors?.length) {
      const first = json.errors[0];
      throw new Error(typeof first?.message === "string" ? first.message : "GraphQL error.");
    }

    const rows = template.pickRows(json);
    if (!Array.isArray(rows)) {
      throw new Error("Query returned no members array.");
    }

    if (!rows.length) break;
    totalRows += rows.length;

    for (const row of rows) {
      const wallet = normalizeMemberAddress(row);
      if (!wallet) continue;

      const shares = parseBigInt(row?.shares);
      const loot = parseBigInt(row?.loot);
      const votingPower = shares + loot;
      if (!includeZeroPower && votingPower <= 0n) continue;

      const existing = dedup.get(wallet);
      if (existing) {
        existing.shares = maxBigInt(existing.shares, shares);
        existing.loot = maxBigInt(existing.loot, loot);
        existing.voting_power = maxBigInt(existing.voting_power, votingPower);
        continue;
      }

      dedup.set(wallet, {
        wallet_address: wallet,
        shares: shares.toString(),
        loot: loot.toString(),
        voting_power: votingPower.toString(),
        status: votingPower > 0n ? "active" : "inactive",
        raw_id: typeof row?.id === "string" ? row.id : null,
        created_at: typeof row?.createdAt === "string" ? row.createdAt : null,
      });
    }

    const nextLast = rows[rows.length - 1]?.id;
    if (typeof nextLast !== "string" || !nextLast.length) break;
    lastId = nextLast;
  }

  return {
    totalRows,
    members: Array.from(dedup.values()).sort((a, b) =>
      a.wallet_address.localeCompare(b.wallet_address),
    ),
  };
}

async function upsertDaoMemberships({
  supabase,
  daoId,
  chainId,
  graphUrl,
  members,
  deactivateMissing,
  syncEntitlements,
}) {
  const now = new Date().toISOString();
  const rows = members.map((member) => ({
    dao_id: daoId,
    chain_id: chainId,
    wallet_address: member.wallet_address,
    status: member.status === "active" ? "active" : "inactive",
    shares: member.shares,
    loot: member.loot,
    voting_power: member.voting_power,
    source: {
      kind: "subgraph",
      graph_url: graphUrl,
    },
    verification: {
      method: "subgraph-sync",
      checked_at: now,
    },
    raw: member,
    last_synced_at: now,
    first_seen_at: now,
  }));

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await supabase.from("dao_memberships").upsert(chunk, {
      onConflict: "dao_id,chain_id,wallet_address",
      ignoreDuplicates: false,
    });
    if (error) {
      throw new Error(`Failed upserting dao_memberships: ${error.message}`);
    }
  }
  console.log(`Upserted dao_memberships rows: ${rows.length}`);

  if (deactivateMissing) {
    const memberWallets = new Set(members.map((item) => item.wallet_address.toLowerCase()));
    const { data: existingRows, error: existingError } = await supabase
      .from("dao_memberships")
      .select("id, wallet_address, user_id")
      .eq("dao_id", daoId)
      .eq("chain_id", chainId)
      .eq("status", "active");

    if (existingError) {
      throw new Error(`Failed loading active dao_memberships: ${existingError.message}`);
    }

    const stale = (existingRows ?? []).filter(
      (row) => !memberWallets.has(String(row.wallet_address ?? "").toLowerCase()),
    );

    if (stale.length) {
      const staleIds = stale.map((row) => row.id);
      for (const chunkIds of chunkArray(staleIds, 500)) {
        const { error } = await supabase
          .from("dao_memberships")
          .update({
            status: "inactive",
            last_synced_at: now,
            verification: {
              method: "subgraph-sync",
              checked_at: now,
              reason: "not-found-in-latest-snapshot",
            },
          })
          .in("id", chunkIds);
        if (error) {
          throw new Error(`Failed marking stale memberships inactive: ${error.message}`);
        }
      }
      console.log(`Marked memberships inactive: ${stale.length}`);
    } else {
      console.log("No stale active memberships to deactivate.");
    }
  }

  if (!syncEntitlements) return;

  const { data: membershipRows, error: membershipError } = await supabase
    .from("dao_memberships")
    .select("user_id, wallet_address, status")
    .eq("dao_id", daoId)
    .eq("chain_id", chainId)
    .not("user_id", "is", null);

  if (membershipError) {
    throw new Error(`Failed loading claimed memberships for entitlement sync: ${membershipError.message}`);
  }

  const entByUser = new Map();
  for (const row of membershipRows ?? []) {
    const userId = row.user_id;
    if (!userId) continue;
    const current = entByUser.get(userId);
    const nextStatus = row.status === "active" ? "active" : "inactive";
    if (!current) {
      entByUser.set(userId, {
        user_id: userId,
        entitlement: "dao-member",
        status: nextStatus,
        metadata: {
          source: "dao-sync",
          dao_id: daoId,
          chain_id: chainId,
          wallet_address: row.wallet_address,
          synced_at: now,
        },
      });
      continue;
    }

    // If any wallet is active, keep entitlement active.
    if (current.status === "inactive" && nextStatus === "active") {
      current.status = "active";
      current.metadata = {
        source: "dao-sync",
        dao_id: daoId,
        chain_id: chainId,
        wallet_address: row.wallet_address,
        synced_at: now,
      };
    }
  }
  const entRows = Array.from(entByUser.values());

  if (!entRows.length) {
    console.log("No claimed memberships found for entitlement sync.");
    return;
  }

  for (const chunk of chunkArray(entRows, 500)) {
    const { error } = await supabase.from("entitlements").upsert(chunk, {
      onConflict: "user_id,entitlement",
    });
    if (error) {
      throw new Error(`Failed syncing dao-member entitlements: ${error.message}`);
    }
  }
  console.log(`Synced dao-member entitlements: ${entRows.length}`);
}

async function seedClaimableProfiles({
  supabase,
  members,
}) {

  const rows = members.map((member) => ({
    handle: makeDaoHandle(member.wallet_address),
    display_name: `DAO Member ${shortAddress(member.wallet_address)}`,
    wallet_address: member.wallet_address,
    bio: "Imported from DAO member snapshot. Claim this profile with wallet sign-in.",
    user_id: null,
  }));

  const handles = rows.map((row) => row.handle);
  const { data: existingRows, error: existingError } = await supabase
    .from("profiles")
    .select("handle")
    .in("handle", handles);

  if (existingError) {
    throw new Error(`Failed checking existing profiles: ${existingError.message}`);
  }

  const existing = new Set((existingRows ?? []).map((row) => row.handle));
  const missing = rows.filter((row) => !existing.has(row.handle));
  if (!missing.length) {
    console.log("No missing claimable profiles to insert.");
    return;
  }

  const { error: insertError } = await supabase.from("profiles").insert(missing);
  if (insertError) {
    throw new Error(`Failed inserting claimable profiles: ${insertError.message}`);
  }

  console.log(`Inserted ${missing.length} claimable profiles.`);
}

async function graphRequest({ graphUrl, graphApiKey, query, variables }) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (graphApiKey) {
    headers.Authorization = `Bearer ${graphApiKey}`;
  }

  const response = await fetch(graphUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (json && typeof json === "object" && json.error) ||
      `Graph request failed: ${response.status}`;
    throw new Error(String(message));
  }
  return json;
}

function normalizeMemberAddress(row) {
  const candidates = [
    row?.memberAddress,
    row?.member_address,
    row?.address,
    row?.member?.id,
    row?.member,
    extractAddressFromId(row?.id),
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const match = candidate.match(/0x[a-fA-F0-9]{40}/);
    if (!match) continue;
    return match[0].toLowerCase();
  }
  return null;
}

function extractAddressFromId(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/0x[a-fA-F0-9]{40}/g);
  if (!match || !match.length) return null;
  return match[match.length - 1];
}

function parseBigInt(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.max(0, Math.trunc(value)));
  if (typeof value !== "string") return 0n;
  if (!value.trim()) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function maxBigInt(a, b) {
  return a > b ? a : b;
}

function defaultSnapshotPath(daoId) {
  const stamp = new Date().toISOString().replaceAll(":", "-");
  return path.join("snapshots", `dao-members-${daoId}-${stamp}.json`);
}

function makeDaoHandle(wallet) {
  return `dao-${wallet.replace(/^0x/, "").toLowerCase()}`;
}

function shortAddress(wallet) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=");
    const key = rawKey.trim();
    if (!key) continue;

    if (inlineValue != null) {
      out[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
