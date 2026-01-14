import { AnnouncementsAdmin } from "@/modules/announcements/AnnouncementsAdmin";
import { AnnouncementsList } from "@/modules/announcements/AnnouncementsList";

export default function AnnouncementsModulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Create and schedule cohort announcements.
        </p>
      </div>
      <AnnouncementsAdmin />
      <div>
        <h2 className="text-lg font-semibold">Published announcements</h2>
        <div className="mt-3">
          <AnnouncementsList />
        </div>
      </div>
    </div>
  );
}
