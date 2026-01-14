import type { Profile } from "./types";

export function getProfileCompletion(profile: Profile, userEmail?: string | null) {
  const items = [
    { label: "Handle", done: Boolean(profile.handle?.trim()) },
    { label: "Display name", done: Boolean(profile.displayName?.trim()) },
    { label: "Bio", done: Boolean(profile.bio?.trim()) },
    { label: "Location", done: Boolean(profile.location?.trim()) },
    { label: "Skills", done: (profile.skills ?? []).length > 0 },
    { label: "Roles", done: (profile.roles ?? []).length > 0 },
    {
      label: "Linked email",
      done: Boolean(userEmail || profile.email?.trim()),
    },
    {
      label: "Wallet address",
      done: Boolean(profile.walletAddress?.trim()),
    },
    {
      label: "Avatar",
      done: Boolean(profile.avatarUrl?.trim()),
    },
  ];

  const completed = items.filter((item) => item.done).length;
  const percent = Math.round((completed / items.length) * 100);
  const missing = items.length - completed;

  return { items, percent, missing };
}
