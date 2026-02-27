import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

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

  it("keeps dedupe_key null when dedupeKey is omitted", async () => {
    loadRegistry.mockReturnValue({
      modules: [
        {
          id: "member-forum",
          capabilities: {
            events: {
              emit: {
                kinds: ["core.member_forum.post_created"],
                requiresUserAuth: false,
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
      moduleId: "member-forum",
      kind: "core.member_forum.post_created",
      actorId: "user-2",
      data: { title: "Hello" },
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ dedupe_key: null }));
  });
});

describe("verifyModuleKey", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("returns true for matching key hash", async () => {
    const key = "module-secret";
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    const maybeSingle = vi.fn().mockResolvedValue({ data: { key_hash: keyHash }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });

    const { verifyModuleKey } = await import("./portal-events");
    await expect(verifyModuleKey("guild-grimoire", key)).resolves.toBe(true);
  });

  it("returns false for malformed stored hash", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { key_hash: "not-a-valid-sha256-hash" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });

    const { verifyModuleKey } = await import("./portal-events");
    await expect(verifyModuleKey("guild-grimoire", "module-secret")).resolves.toBe(false);
  });
});
