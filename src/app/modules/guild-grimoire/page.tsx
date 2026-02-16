import { GuildGrimoire } from "@/modules/guild-grimoire/GuildGrimoire";

export default function GuildGrimoireModulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Guild Grimoire</h1>
        <p className="text-sm text-muted-foreground">
          Post quick updates as text, an image, or an audio clip — and browse the shared
          stream.
        </p>
      </div>
      <GuildGrimoire />
    </div>
  );
}
