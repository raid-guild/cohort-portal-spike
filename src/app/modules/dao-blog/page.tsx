import { DaoBlogIndex } from "@/modules/dao-blog/DaoBlogIndex";

export default function DaoBlogPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">DAO Blog</h1>
        <p className="text-sm text-muted-foreground">
          Public updates, announcements, and thought pieces from RaidGuild.
        </p>
      </div>
      <DaoBlogIndex />
    </div>
  );
}
