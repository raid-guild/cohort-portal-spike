import type { Metadata } from "next";
import { DaoBlogManage } from "@/modules/dao-blog/DaoBlogManage";

export const metadata: Metadata = {
  title: "DAO Blog Manage",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DaoBlogManagePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">DAO Blog Manager</h1>
        <p className="text-sm text-muted-foreground">Draft, review, and publish DAO Blog posts.</p>
      </div>
      <DaoBlogManage />
    </div>
  );
}
