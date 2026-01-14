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

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file." }, { status: 400 });
  }

  const extension = file.name.split(".").pop() || "png";
  const path = `${data.user.id}/avatar.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const admin = supabaseAdminClient();
  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type || "image/png",
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicData } = admin.storage.from("avatars").getPublicUrl(path);

  return Response.json({ url: publicData.publicUrl });
}
