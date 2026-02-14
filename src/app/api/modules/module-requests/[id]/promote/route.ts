import { NextRequest } from "next/server";
import { requireHost } from "../../_auth";
import { toGitHubIssueMarkdown, type ModuleRequestSpec } from "../../lib";

type PromoteBody = {
  github_issue_url?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHost(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status ?? 400 });
  }

  const { id } = await params;
  const admin = auth.admin;

  let body: PromoteBody = {};
  try {
    body = (await request.json()) as PromoteBody;
  } catch {
    // ok
  }

  const { data, error } = await admin
    .from("module_requests")
    .select(
      "id, module_id, title, owner_contact, status, spec, github_issue_url, votes_count, promotion_threshold, submitted_to_github_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (!(data.status === "ready" || data.status === "open")) {
    return Response.json({ error: "Only open/ready requests can be promoted." }, { status: 400 });
  }

  const markdown = toGitHubIssueMarkdown({
    title: data.title,
    moduleId: data.module_id,
    ownerContact: data.owner_contact,
    spec: (data.spec ?? {}) as ModuleRequestSpec,
  });

  const githubUrl = typeof body.github_issue_url === "string" ? body.github_issue_url.trim() : "";

  if (githubUrl) {
    const { data: updated, error: updateError } = await admin
      .from("module_requests")
      .update({
        github_issue_url: githubUrl,
        submitted_to_github_at: new Date().toISOString(),
        status: "submitted_to_github",
      })
      .eq("id", id)
      .select(
        "id, created_by, module_id, title, owner_contact, status, spec, votes_count, promotion_threshold, github_issue_url, submitted_to_github_at, created_at, updated_at",
      )
      .single();

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    return Response.json({ item: updated, markdown });
  }

  return Response.json({ markdown, item: data });
}
