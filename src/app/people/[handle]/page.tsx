import { notFound } from "next/navigation";
import { ProfileHeader } from "@/components/ProfileHeader";
import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { loadPerson } from "@/lib/people";
import { loadRegistry } from "@/lib/registry";
import { supabaseAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{ handle: string }>;
};

export default async function ProfilePage({ params }: PageProps) {
  const { handle } = await params;
  const profile = await loadPerson(handle);
  if (!profile) {
    notFound();
  }
  const portalRoles = profile.userId
    ? (
        await supabaseAdminClient()
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.userId)
      ).data?.map((row) => row.role) ?? []
    : [];

  const registry = loadRegistry();
  const surfaceModules = registry.modules.filter((mod) =>
    mod.tags?.includes("profile-tools-public"),
  );

  return (
    <div className="space-y-8">
      <ProfileHeader profile={profile} portalRoles={portalRoles} />

      <section className="space-y-6">
        <ModuleSurfaceList
          modules={surfaceModules}
          surface="profile"
          summaryParams={{ handle: profile.handle }}
        />
      </section>
    </div>
  );
}
