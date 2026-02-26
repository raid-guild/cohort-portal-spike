import Link from "next/link";
import { DaoBlogIndex } from "@/modules/dao-blog/DaoBlogIndex";

export default function DaoBlogPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">DAO Blog</h1>
          <p className="text-sm text-muted-foreground">
            Public updates, announcements, and thought pieces from RaidGuild.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/modules/dao-blog/manage"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Manage posts
          </Link>
          <Link
            href="/modules/dao-blog/manage/new"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            New post
          </Link>
        </div>
      </div>
      <DaoBlogIndex />
    </div>
  );
}
