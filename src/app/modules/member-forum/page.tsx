import { MemberForum } from "@/modules/member-forum/MemberForum";

export default function MemberForumPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Member Forum</h1>
        <p className="text-sm text-muted-foreground">
          Browse spaces, post updates, and reply in threaded discussions.
        </p>
      </div>
      <MemberForum mode="feed" />
    </div>
  );
}
