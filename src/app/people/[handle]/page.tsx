import { notFound } from "next/navigation";
import { ProfileHeader } from "@/components/ProfileHeader";
import { ModuleSurfaceList } from "@/components/ModuleSurfaceList";
import { BadgesSection } from "@/components/BadgesSection";
import { loadPerson } from "@/lib/people";
import { loadRegistry } from "@/lib/registry";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { loadUserEntitlement } from "@/lib/entitlements";
import { loadBadgesForUser } from "@/lib/badges";

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
  const entitlement = profile.userId
    ? await loadUserEntitlement(profile.userId, "cohort-access")
    : null;

  const badges = profile.userId ? await loadBadgesForUser(profile.userId) : [];
  const paidSource =
    entitlement?.metadata && typeof entitlement.metadata === "object"
      ? ((entitlement.metadata as Record<string, unknown>).source as
          | string
          | null)
      : null;

  const registry = loadRegistry();
  const surfaceModules = registry.modules.filter((mod) =>
    mod.tags?.includes("profile-tools-public"),
  );

  return (
    <div className="space-y-8">
      <ProfileHeader
        profile={profile}
        portalRoles={portalRoles}
        isPaid={Boolean(entitlement)}
        paidSource={paidSource}
      />

      <BadgesSection badges={badges} />

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
