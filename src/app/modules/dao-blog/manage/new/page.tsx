import type { Metadata } from "next";
import { DaoBlogEditor } from "@/modules/dao-blog/DaoBlogEditor";

export const metadata: Metadata = {
  title: "DAO Blog New Post",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DaoBlogNewPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">New DAO Blog Post</h1>
        <p className="text-sm text-muted-foreground">Create a new markdown draft for review.</p>
      </div>
      <DaoBlogEditor />
    </div>
  );
}
