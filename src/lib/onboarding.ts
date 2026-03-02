export const ONBOARDING_ROLES_LIMIT = 2;

export type OnboardingProfile = {
  handle?: string | null;
  displayName?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  roles?: string[] | null;
};

export function isOnboardingComplete(
  profile: OnboardingProfile,
  rolesLimit: number = ONBOARDING_ROLES_LIMIT,
) {
  const roles = (profile.roles ?? []).filter((role) => Boolean(role?.trim()));
  const skills = (profile.skills ?? []).filter((skill) => Boolean(skill?.trim()));
  return (
    Boolean(profile.handle?.trim()) &&
    Boolean(profile.displayName?.trim()) &&
    Boolean(profile.bio?.trim()) &&
    roles.length > 0 &&
    roles.length <= rolesLimit &&
    skills.length > 0
  );
}
