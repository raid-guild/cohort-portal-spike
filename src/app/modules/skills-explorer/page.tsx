import { SkillsExplorer } from "@/modules/skills-explorer/SkillsExplorer";

export default function SkillsExplorerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Skills Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Explore skill distribution across the cohort.
        </p>
      </div>
      <SkillsExplorer />
    </div>
  );
}
