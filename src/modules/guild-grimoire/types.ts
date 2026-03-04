export type GuildGrimoireContentType = "text" | "image" | "audio";
export type GuildGrimoireVisibility = "private" | "shared" | "cohort" | "public";
export type GuildGrimoireTranscriptionStatus = "pending" | "completed" | "failed" | null;

export type GuildGrimoireTag = {
  id: string;
  slug: string;
  label: string;
};

export type GuildGrimoireAuthor = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type GuildGrimoireNote = {
  id: string;
  user_id: string;
  content_type: GuildGrimoireContentType;
  text_content: string | null;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  audio_transcript: string | null;
  audio_transcription_status: GuildGrimoireTranscriptionStatus;
  visibility: GuildGrimoireVisibility;
  created_at: string;
  deleted_at: string | null;
  author: GuildGrimoireAuthor | null;
  tags: GuildGrimoireTag[];
};
