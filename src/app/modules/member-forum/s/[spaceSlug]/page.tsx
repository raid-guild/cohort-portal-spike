import { MemberForum } from "@/modules/member-forum/MemberForum";

export default async function MemberForumSpacePage({
  params,
}: {
  params: Promise<{ spaceSlug: string }>;
}) {
  const resolved = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Member Forum</h1>
        <p className="text-sm text-muted-foreground">Space feed for /{resolved.spaceSlug}</p>
      </div>
      <MemberForum mode="space" spaceSlug={resolved.spaceSlug} />
    </div>
  );
}
