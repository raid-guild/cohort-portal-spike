import { BadgesAdmin } from "@/modules/badges/BadgesAdmin";
import { BadgesGallery } from "@/modules/badges/BadgesGallery";

export default function BadgesModulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Badges</h1>
        <p className="text-sm text-muted-foreground">
          Create and award community badges. Badges show on public profiles.
        </p>
      </div>

      <BadgesAdmin />

      <div>
        <h2 className="text-lg font-semibold">Active badges</h2>
        <div className="mt-3">
          <BadgesGallery />
        </div>
      </div>
    </div>
  );
}
