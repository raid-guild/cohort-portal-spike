alter table public.guild_grimoire_notes
add column if not exists audio_transcription_status text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'guild_grimoire_notes_audio_transcription_status_check'
      and conrelid = 'public.guild_grimoire_notes'::regclass
  ) then
    alter table public.guild_grimoire_notes
    add constraint guild_grimoire_notes_audio_transcription_status_check
    check (
      audio_transcription_status is null
      or audio_transcription_status in ('pending', 'completed', 'failed')
    );
  end if;
end $$;

update public.guild_grimoire_notes
set audio_transcription_status = case
  when content_type = 'audio' and audio_transcript is not null then 'completed'
  when content_type = 'audio' then null
  else null
end
where audio_transcription_status is null;
