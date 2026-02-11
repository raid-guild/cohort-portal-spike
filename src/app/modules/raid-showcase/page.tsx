import { RaidShowcaseFeed } from "@/modules/raid-showcase/RaidShowcaseFeed";

export default function RaidShowcaseModulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Raid Showcase</h1>
        <p className="text-sm text-muted-foreground">
          Share proof-of-work wins as a visual feed.
        </p>
      </div>
      <RaidShowcaseFeed />
    </div>
  );
}
