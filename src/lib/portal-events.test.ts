import { beforeEach, describe, expect, it, vi } from "vitest";

const loadRegistry = vi.fn();
const from = vi.fn();

vi.mock("@/lib/registry", () => ({
  loadRegistry,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: () => ({ from }),
}));

describe("emitPortalEvent", () => {
  beforeEach(() => {
    loadRegistry.mockReset();
    from.mockReset();
  });

  it("writes normalized event row to portal_events", async () => {
    loadRegistry.mockReturnValue({
      modules: [
        {
          id: "guild-grimoire",
          capabilities: {
            events: {
              emit: {
                kinds: ["core.guild_grimoire.note_created"],
                requiresUserAuth: true,
              },
            },
          },
        },
      ],
    });

    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ insert });

    const { emitPortalEvent } = await import("./portal-events");
    await emitPortalEvent({
      moduleId: "guild-grimoire",
      kind: "core.guild_grimoire.note_created",
      authenticatedUserId: "user-1",
      actorId: "user-1",
      subject: { type: "guild_grimoire_note", id: "note-1" },
      visibility: "authenticated",
      data: { contentType: "text" },
      dedupeKey: "guild_grimoire_note:note-1:created",
    });

    expect(from).toHaveBeenCalledWith("portal_events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        module_id: "guild-grimoire",
        kind: "core.guild_grimoire.note_created",
        actor_id: "user-1",
        dedupe_key: "guild_grimoire_note:note-1:created",
      }),
    );
  });

  it("rejects emit when authenticated user is required but absent", async () => {
    loadRegistry.mockReturnValue({
      modules: [
        {
          id: "member-forum",
          capabilities: {
            events: {
              emit: {
                kinds: ["core.member_forum.post_created"],
                requiresUserAuth: true,
              },
            },
          },
        },
      ],
    });

    const { emitPortalEvent } = await import("./portal-events");
    await expect(
      emitPortalEvent({
        moduleId: "member-forum",
        kind: "core.member_forum.post_created",
      }),
    ).rejects.toThrow("Authenticated user required");
  });
});
