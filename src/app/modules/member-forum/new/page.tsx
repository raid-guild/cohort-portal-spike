import { MemberForum } from "@/modules/member-forum/MemberForum";

export default async function MemberForumNewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const resolved = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Create Forum Post</h1>
      </div>
      <MemberForum mode="new" spaceSlug={resolved.space} />
    </div>
  );
}
