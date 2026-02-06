import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const admin = supabaseAdminClient();
  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  if (roleError) {
    return Response.json({ error: roleError.message }, { status: 500 });
  }

  const roles = roleRows?.map((row) => row.role) ?? [];
  if (!roles.includes("host")) {
    return Response.json({ error: "Host role required." }, { status: 403 });
  }

  const formData = await request.formData();
  const badgeId = String(formData.get("badgeId") ?? "")
    .trim()
    .toLowerCase();
  const file = formData.get("file");
  if (!badgeId) {
    return Response.json({ error: "Missing badgeId." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file." }, { status: 400 });
  }

  const extension = file.name.split(".").pop() || "png";
  const path = `badges/${badgeId}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("modules")
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type || "image/png",
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicData } = admin.storage.from("modules").getPublicUrl(path);

  return Response.json({ url: publicData.publicUrl, path });
}
