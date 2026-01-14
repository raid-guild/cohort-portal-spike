import { notFound } from "next/navigation";
import { getModuleById } from "@/lib/registry";
import { BadgePill } from "@/components/BadgePill";
import { HostOnly } from "@/components/HostOnly";

type PageProps = {
  params: { id: string };
};

export default async function ModuleDetailPage({ params }: PageProps) {
  const module = getModuleById(params.id);
  if (!module) {
    notFound();
  }

  const content = (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold">{module.title}</h1>
          {module.status ? <BadgePill>{module.status}</BadgePill> : null}
        </div>
        {module.description ? (
          <p className="text-sm text-muted-foreground">{module.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs">
          <BadgePill>{module.lane}</BadgePill>
          <BadgePill>{module.type}</BadgePill>
          {module.requiresAuth ? <BadgePill>auth</BadgePill> : null}
        </div>
      </div>

      {module.url ? (
        <a
          href={module.url}
          className="inline-flex rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          target="_blank"
          rel="noreferrer"
        >
          Open Module
        </a>
      ) : null}

      {module.type === "embed" && module.url ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <iframe
            src={module.url}
            className="w-full"
            style={{ height: module.embed?.height ?? 720 }}
            title={module.title}
          />
        </div>
      ) : null}

    </div>
  );

  if (module.tags?.includes("hosts")) {
    return <HostOnly>{content}</HostOnly>;
  }

  return content;
}
