// Lightweight health endpoint for deploy readiness + smoke tests.
// Avoid returning secrets. Safe to expose publicly.

export const runtime = "nodejs";

export async function GET() {
  const now = new Date().toISOString();

  // Vercel automatically provides these for Git deployments.
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    null;
  const ref = process.env.VERCEL_GIT_COMMIT_REF || null;
  const repo = process.env.VERCEL_GIT_REPO_SLUG || null;
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || null;

  return Response.json(
    {
      ok: true,
      now,
      env,
      git: { sha, ref, repo },
    },
    {
      headers: {
        // Encourage callers to bust caches; we want "current deploy" signal.
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
