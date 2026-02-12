export type ModuleViewSurfaceConfig = {
  order?: string[];
  hidden?: string[];
};

export type ModuleViewsConfig = {
  version: 1;
  surfaces?: Record<string, ModuleViewSurfaceConfig>;
};

export function getSurfaceViewConfig(
  config: ModuleViewsConfig | null | undefined,
  surface: string,
  moduleIds: string[],
) {
  const stored = config?.surfaces?.[surface];
  const knownIds = new Set(moduleIds);
  const order = Array.isArray(stored?.order) ? stored.order : [];
  const normalizedOrder = order.filter((id) => knownIds.has(id));
  const seen = new Set(normalizedOrder);

  for (const id of moduleIds) {
    if (seen.has(id)) continue;
    normalizedOrder.push(id);
    seen.add(id);
  }

  const hidden = Array.isArray(stored?.hidden) ? stored.hidden : [];
  const normalizedHidden = hidden.filter((id) => knownIds.has(id));

  return {
    order: normalizedOrder,
    hidden: normalizedHidden,
  };
}
