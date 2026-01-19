const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/make-host.js <user-id>");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function run() {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "host" }, { onConflict: "user_id,role" });

  if (error) {
    console.error("Failed to grant host role:", error.message);
    process.exit(1);
  }

  const { error: entitlementError } = await supabase
    .from("entitlements")
    .upsert(
      [
        {
          user_id: userId,
          entitlement: "cohort-approved",
          status: "active",
          metadata: { source: "host-grant" },
        },
        {
          user_id: userId,
          entitlement: "cohort-access",
          status: "active",
          metadata: { source: "host-grant" },
        },
      ],
      { onConflict: "user_id,entitlement" },
    );

  if (entitlementError) {
    console.error("Failed to grant host entitlements:", entitlementError.message);
    process.exit(1);
  }

  console.log(`Host role + entitlements granted to ${userId}`);
}

run();
