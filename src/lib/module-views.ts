export type ModuleViewSurfaceConfig = {
  order?: string[];
  hidden?: string[];
};

export type ModuleViewsConfig = {
  version: 1;
  surfaces?: Record<string, ModuleViewSurfaceConfig>;
};

const DEFAULT_VISIBLE_MODULES_BY_SURFACE: Record<string, string[]> = {
  // Keep first-time /me focused; users can enable more via Customize.
  me: ["profile-completion", "cohort-application"],
};

export function getSurfaceViewConfig(
  config: ModuleViewsConfig | null | undefined,
  surface: string,
  moduleIds: string[],
) {
  const stored = config?.surfaces?.[surface];
  const hasStoredSurface = Boolean(stored);
  const knownIds = new Set(moduleIds);
  const order = Array.isArray(stored?.order) ? stored.order : [];
  const normalizedOrder = order.filter((id) => knownIds.has(id));
  moduleIds.forEach((id) => {
    if (!normalizedOrder.includes(id)) {
      normalizedOrder.push(id);
    }
  });

  const hidden = Array.isArray(stored?.hidden) ? stored.hidden : [];
  let normalizedHidden = hidden.filter((id) => knownIds.has(id));

  if (!hasStoredSurface) {
    const defaultVisible = DEFAULT_VISIBLE_MODULES_BY_SURFACE[surface] ?? moduleIds;
    const defaultVisibleSet = new Set(defaultVisible.filter((id) => knownIds.has(id)));
    normalizedHidden = moduleIds.filter((id) => !defaultVisibleSet.has(id));
  }

  return {
    order: normalizedOrder,
    hidden: normalizedHidden,
  };
}
