export type ScheduleEvent = {
  id: string;
  day: number;
  title: string;
  description: string;
  date: string | null;
  type: string;
};

export type ProjectCard = {
  id: string;
  title: string;
  description: string;
  links: string[];
  notes: string;
};

export type ResourceCard = {
  id: string;
  title: string;
  description: string;
  link: string;
  type: string;
  category: string;
};

export type ParticipantCard = {
  handle: string;
  displayName: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  bio: string | null;
  links: Record<string, string>;
};

export type PartnerCard = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string;
  websiteUrl: string | null;
};

export type QuestItem = {
  id: string;
  label: string;
  completed: boolean;
};
