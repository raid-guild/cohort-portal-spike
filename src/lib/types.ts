export type Profile = {
  userId?: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  walletAddress?: string;
  email?: string;
  links?: { label: string; url: string }[];
  cohorts?: { id: string; role?: string; year?: number }[];
  skills?: string[];
  roles?: string[];
  location?: string;
  contact?: { farcaster?: string; telegram?: string; email?: string };
};

export type Cohort = {
  id: string;
  theme: string;
  startDate: string;
  endDate: string;
};

export type ModuleEntry = {
  id: string;
  title: string;
  description?: string;
  lane: string;
  type: "link" | "embed";
  url?: string;
  embed?: { height?: number };
  status?: "planned" | "in-progress" | "beta" | "live";
  owner?: { name: string; contact?: string };
  requiresAuth?: boolean;
  tags?: string[];
  surfaces?: string[];
  presentation?: {
    mode?: "card" | "dialog" | "drawer" | "page";
    trigger?: "button" | "card" | "link";
    dialog?: { size?: "sm" | "md" | "lg" };
    iframe?: { height?: number };
    action?: "open" | "none";
    actionLabel?: string;
    layout?: "wide";
    height?: "double";
  };
  summary?: {
    source: "static" | "api";
    title?: string;
    items?: { label: string; value: string }[];
    endpoint?: string;
    layout?: "list" | "excerpt" | "compact";
    maxItems?: number;
    truncate?: number;
    showTitle?: boolean;
    progressKey?: string;
    imageKey?: string;
  };
  summaryBySurface?: Record<
    string,
    {
      source: "static" | "api";
      title?: string;
      items?: { label: string; value: string }[];
      endpoint?: string;
      layout?: "list" | "excerpt" | "compact";
      maxItems?: number;
      truncate?: number;
      showTitle?: boolean;
      progressKey?: string;
      imageKey?: string;
    }
  >;
  capabilities?: {
    dataWrite?: { requiresKey?: boolean };
    profileWrite?: { fields?: string[]; requiresKey?: boolean; requiresUserAuth?: boolean };
    announcementsWrite?: { requiresUserAuth?: boolean; allowedRoles?: string[] };
    aiGenerate?: { requiresUserAuth?: boolean; provider?: string };
    portalRpc?: { allowedActions?: string[] };
  };
  access?: {
    requiresAuth?: boolean;
    entitlement?: string;
  };
  allowedOrigins?: string[];
};

export type Registry = {
  cohort: Cohort;
  modules: ModuleEntry[];
};
