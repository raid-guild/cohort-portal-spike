export type GuildGrimoireContentType = "text" | "image" | "audio";
export type GuildGrimoireVisibility = "private" | "shared" | "cohort" | "public";

export type GuildGrimoireTag = {
  id: string;
  slug: string;
  label: string;
};

export type GuildGrimoireNote = {
  id: string;
  user_id: string;
  content_type: GuildGrimoireContentType;
  text_content: string | null;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  visibility: GuildGrimoireVisibility;
  created_at: string;
  deleted_at: string | null;
  tags: GuildGrimoireTag[];
};
