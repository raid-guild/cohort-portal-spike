const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const registryPath = path.join(process.cwd(), "modules", "registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function run() {
  const rows = registry.modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description ?? null,
    lane: mod.lane ?? null,
    type: mod.type ?? null,
    url: mod.url ?? null,
    status: mod.status ?? null,
    owner: mod.owner ?? null,
    requires_auth: mod.requiresAuth ?? null,
    tags: mod.tags ?? null,
    surfaces: mod.surfaces ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("modules").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(`Synced ${rows.length} modules.`);
}

run();
