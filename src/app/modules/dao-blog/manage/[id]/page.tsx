import type { Metadata } from "next";
import { DaoBlogEditor } from "@/modules/dao-blog/DaoBlogEditor";

export const metadata: Metadata = {
  title: "DAO Blog Edit Post",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DaoBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Edit DAO Blog Post</h1>
        <p className="text-sm text-muted-foreground">Slug is immutable after create.</p>
      </div>
      <DaoBlogEditor postId={id} />
    </div>
  );
}
