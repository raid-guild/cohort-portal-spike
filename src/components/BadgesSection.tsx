import Image from "next/image";
import type { UserBadge } from "@/lib/badges";

type Props = {
  badges: UserBadge[];
};

export function BadgesSection({ badges }: Props) {
  if (!badges.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Badges</h2>
        <p className="text-sm text-muted-foreground">
          Achievements and recognitions earned in the community.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {badges.map((badge) => (
          <div
            key={badge.badgeId}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
            title={badge.definition.description ?? undefined}
          >
            {badge.definition.image_url ? (
              <Image
                src={badge.definition.image_url}
                alt={badge.definition.title}
                width={32}
                height={32}
                className="h-8 w-8 rounded-md"
              />
            ) : (
              <div className="h-8 w-8 rounded-md bg-muted" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {badge.definition.title}
              </div>
              {badge.definition.description ? (
                <div className="truncate text-xs text-muted-foreground">
                  {badge.definition.description}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
