import { MemberForum } from "@/modules/member-forum/MemberForum";

export default async function MemberForumPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const resolved = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Member Forum</h1>
      </div>
      <MemberForum mode="post" postId={resolved.postId} />
    </div>
  );
}
