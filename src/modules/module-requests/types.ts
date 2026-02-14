export type ModuleRequestStatus =
  | "draft"
  | "open"
  | "ready"
  | "submitted_to_github"
  | "archived";

export type ModuleRequest = {
  id: string;
  created_by: string;
  module_id: string;
  title: string;
  owner_contact: string | null;
  status: ModuleRequestStatus;
  spec: Record<string, unknown>;
  votes_count: number;
  promotion_threshold: number;
  github_issue_url: string | null;
  submitted_to_github_at: string | null;
  created_at: string;
  updated_at: string;
  viewer_has_voted?: boolean;
};
