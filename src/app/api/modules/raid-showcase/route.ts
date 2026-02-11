import { NextRequest } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseServerClient } from "@/lib/supabase/server";

const MAX_TITLE = 100;
const MAX_IMPACT = 280;

export async function GET() {
  const admin = supabaseAdminClient();
  const { data, error } = await admin
    .from("showcase_posts")
    .select("id,user_id,image_url,title,impact_statement,boost_count,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ posts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing auth token." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = supabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "Invalid auth token." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  let title: string | null = null;
  let impactStatement: string | null = null;
  let imageUrl: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const titleField = formData.get("title");
    const impactField = formData.get("impact_statement");
    const imageUrlField = formData.get("image_url");
    const fileField = formData.get("file");

    title = typeof titleField === "string" ? titleField : null;
    impactStatement = typeof impactField === "string" ? impactField : null;
    imageUrl = typeof imageUrlField === "string" ? imageUrlField : null;
    file = fileField instanceof File ? fileField : null;
  } else {
    const json = (await request.json().catch(() => null)) as
      | {
          title?: unknown;
          impact_statement?: unknown;
          image_url?: unknown;
        }
      | null;

    title = typeof json?.title === "string" ? json.title : null;
    impactStatement =
      typeof json?.impact_statement === "string" ? json.impact_statement : null;
    imageUrl = typeof json?.image_url === "string" ? json.image_url : null;
  }

  if (!title || !title.trim()) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  if (title.length > MAX_TITLE) {
    return Response.json(
      { error: `Title must be <= ${MAX_TITLE} characters.` },
      { status: 400 },
    );
  }

  if (!impactStatement || !impactStatement.trim()) {
    return Response.json(
      { error: "Impact statement is required." },
      { status: 400 },
    );
  }

  if (impactStatement.length > MAX_IMPACT) {
    return Response.json(
      { error: `Impact statement must be <= ${MAX_IMPACT} characters.` },
      { status: 400 },
    );
  }

  const admin = supabaseAdminClient();

  if (file) {
    const extension = file.name.split(".").pop() || "png";
    const path = `raid-showcase/${userData.user.id}/${crypto.randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("modules")
      .upload(path, buffer, {
        upsert: false,
        contentType: file.type || "image/png",
      });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = admin.storage.from("modules").getPublicUrl(path);
    imageUrl = publicData.publicUrl;
  }

  if (!imageUrl) {
    return Response.json(
      { error: "Image is required (upload a file or provide image_url)." },
      { status: 400 },
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("showcase_posts")
    .insert({
      user_id: userData.user.id,
      image_url: imageUrl,
      title: title.trim(),
      impact_statement: impactStatement.trim(),
    })
    .select("id,user_id,image_url,title,impact_statement,boost_count,created_at")
    .single();

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ post: inserted }, { status: 201 });
}
