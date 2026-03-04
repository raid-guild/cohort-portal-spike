import { ProfileAvatar } from "./ProfileAvatar";

export function ProfileIdentity({
  handle,
  displayName,
  avatarUrl,
  subtitle,
  avatarSize = 40,
  compact = false,
}: {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  avatarSize?: number;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <ProfileAvatar name={displayName || handle} url={avatarUrl} size={avatarSize} />
      <div className="min-w-0">
        <div className={compact ? "text-sm font-semibold" : "text-base font-semibold"}>
          {displayName}
        </div>
        <div className="text-sm text-muted-foreground">@{handle}</div>
        {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
    </div>
  );
}
