"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type Account = {
  id: string;
  name: string;
  relationship_type: string;
  stage: string;
  status: string;
  owner_user_id: string;
  owner: {
    user_id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  next_follow_up_at: string | null;
  notes?: string | null;
};

type Contact = {
  id: string;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  preferred_channel: string | null;
  is_primary: boolean;
};

type Interaction = {
  id: string;
  interaction_type: string;
  summary: string;
  interaction_at: string;
  author: {
    user_id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Task = {
  id: string;
  title: string;
  due_at: string | null;
  status: string;
  assignee: {
    user_id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type AccountDetail = {
  account: Account;
  contacts: Contact[];
  interactions: Interaction[];
  tasks: Task[];
};

const STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "active",
  "paused",
  "closed-won",
  "closed-lost",
];
const REL_TYPES = ["sponsor", "agency-client", "partner", "other"];

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function asIsoFromLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function RelationshipCrm() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("sponsor");
  const [newStage, setNewStage] = useState("lead");
  const [newFollowUpAt, setNewFollowUpAt] = useState("");

  const [interactionSummary, setInteractionSummary] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const loadAccounts = useCallback(
    async (authToken: string) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (stageFilter) params.set("stage", stageFilter);
      if (typeFilter) params.set("relationshipType", typeFilter);
      if (ownerFilter.trim()) params.set("owner", ownerFilter.trim());
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/modules/relationship-crm/accounts?${params.toString()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = (await res.json()) as { accounts?: Account[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load accounts.");
      }
      const loaded = json.accounts ?? [];
      setAccounts(loaded);

      if (!loaded.length) {
        setSelectedAccountId(null);
        setDetail(null);
        return;
      }
      setSelectedAccountId((prev) => {
        if (prev && loaded.find((row) => row.id === prev)) return prev;
        return loaded[0].id;
      });
    },
    [q, stageFilter, typeFilter, ownerFilter, statusFilter],
  );

  const loadDetail = useCallback(
    async (authToken: string, accountId: string) => {
      const res = await fetch(`/api/modules/relationship-crm/accounts/${accountId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = (await res.json()) as AccountDetail & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to load account detail.");
      }
      setDetail({
        account: json.account,
        contacts: json.contacts ?? [],
        interactions: json.interactions ?? [],
        tasks: json.tasks ?? [],
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const authToken = data.session?.access_token;
      if (!authToken) {
        setToken(null);
        setAccounts([]);
        setDetail(null);
        setError("You must be signed in to use Relationship CRM.");
        return;
      }
      setToken(authToken);
      await loadAccounts(authToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CRM.");
    } finally {
      setLoading(false);
    }
  }, [supabase, loadAccounts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token || !selectedAccountId) return;
    void loadDetail(token, selectedAccountId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load account detail.");
    });
  }, [token, selectedAccountId, loadDetail]);

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/modules/relationship-crm/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName,
          relationshipType: newType,
          stage: newStage,
          status: "active",
          nextFollowUpAt: asIsoFromLocal(newFollowUpAt),
        }),
      });
      const json = (await res.json()) as { account?: Account; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to create account.");
      setNewName("");
      setNewFollowUpAt("");
      await loadAccounts(token);
      if (json.account?.id) {
        setSelectedAccountId(json.account.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setSaving(false);
    }
  }

  async function patchAccount(fields: Record<string, unknown>) {
    if (!token || !selectedAccountId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/modules/relationship-crm/accounts/${selectedAccountId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fields),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update account.");
      await Promise.all([loadAccounts(token), loadDetail(token, selectedAccountId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account.");
    } finally {
      setSaving(false);
    }
  }

  async function postToAccount(path: "contacts" | "interactions" | "tasks", body: Record<string, unknown>) {
    if (!token || !selectedAccountId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/modules/relationship-crm/accounts/${selectedAccountId}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Failed to create ${path}.`);
      await loadDetail(token, selectedAccountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${path}.`);
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: "done" | "canceled") {
    if (!token || !selectedAccountId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/modules/relationship-crm/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update task.");
      await loadDetail(token, selectedAccountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setSaving(false);
    }
  }

  const selectedAccount = detail?.account;

  return (
    <div className="space-y-4">
      {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <form className="grid gap-2 rounded-xl border border-border bg-card p-3 md:grid-cols-6" onSubmit={createAccount}>
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          placeholder="New account name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        >
          {REL_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={newStage}
          onChange={(e) => setNewStage(e.target.value)}
        >
          {STAGES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          type="datetime-local"
          value={newFollowUpAt}
          onChange={(e) => setNewFollowUpAt(e.target.value)}
        />
        <button
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          disabled={saving}
        >
          Create account
        </button>
      </form>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-3 md:grid-cols-6">
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Search accounts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {REL_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Owner user id"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        />
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <button
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={loading}
        >
          Apply filters
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <h2 className="text-sm font-semibold">Accounts</h2>
          {!accounts.length ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              No accounts yet. Create your first account to start tracking follow-ups.
            </div>
          ) : null}
          {accounts.map((account) => {
            const overdue =
              account.next_follow_up_at && new Date(account.next_follow_up_at).getTime() < Date.now();
            const selected = selectedAccountId === account.id;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelectedAccountId(account.id)}
                className={`w-full rounded-lg border border-border p-2 text-left text-sm hover:bg-muted ${
                  selected ? "border-foreground bg-muted/40" : ""
                }`}
              >
                <div className="font-medium">{account.name}</div>
                <div className="text-xs text-muted-foreground">
                  {account.relationship_type} • {account.stage}
                </div>
                {account.next_follow_up_at ? (
                  <div className={`text-xs ${overdue ? "text-red-600" : "text-muted-foreground"}`}>
                    Follow-up: {new Date(account.next_follow_up_at).toLocaleString()}
                    {overdue ? " (overdue)" : ""}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          {!selectedAccount || !detail ? (
            <div className="text-sm text-muted-foreground">Select an account to view details.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{selectedAccount.name}</h2>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{selectedAccount.relationship_type}</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{selectedAccount.stage}</span>
                {selectedAccount.owner ? (
                  <ProfileIdentity
                    handle={selectedAccount.owner.handle}
                    displayName={selectedAccount.owner.display_name || selectedAccount.owner.handle}
                    avatarUrl={selectedAccount.owner.avatar_url}
                    avatarSize={24}
                    compact
                  />
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={selectedAccount.stage}
                  onChange={(e) => {
                    void patchAccount({ stage: e.target.value });
                  }}
                >
                  {STAGES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={selectedAccount.status}
                  onChange={(e) => {
                    void patchAccount({ status: e.target.value });
                  }}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  type="datetime-local"
                  value={toDatetimeLocalValue(selectedAccount.next_follow_up_at)}
                  onChange={(e) => {
                    void patchAccount({ nextFollowUpAt: asIsoFromLocal(e.target.value) });
                  }}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <form
                  className="space-y-2 rounded-lg border border-border bg-card p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!interactionSummary.trim()) return;
                    void postToAccount("interactions", {
                      interactionType: "note",
                      summary: interactionSummary,
                      interactionAt: new Date().toISOString(),
                    }).then(() => setInteractionSummary(""));
                  }}
                >
                  <div className="text-sm font-medium">Add interaction</div>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={interactionSummary}
                    onChange={(e) => setInteractionSummary(e.target.value)}
                    placeholder="Call recap, meeting notes, etc."
                    required
                  />
                  <button
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
                    disabled={saving}
                  >
                    Save interaction
                  </button>
                </form>

                <form
                  className="space-y-2 rounded-lg border border-border bg-card p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!taskTitle.trim()) return;
                    void postToAccount("tasks", {
                      title: taskTitle,
                      dueAt: asIsoFromLocal(taskDueAt),
                    }).then(() => {
                      setTaskTitle("");
                      setTaskDueAt("");
                    });
                  }}
                >
                  <div className="text-sm font-medium">Create task</div>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Next action"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                  />
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    type="datetime-local"
                    value={taskDueAt}
                    onChange={(e) => setTaskDueAt(e.target.value)}
                  />
                  <button
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
                    disabled={saving}
                  >
                    Save task
                  </button>
                </form>

                <form
                  className="space-y-2 rounded-lg border border-border bg-card p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!contactName.trim()) return;
                    void postToAccount("contacts", {
                      fullName: contactName,
                      email: contactEmail || null,
                    }).then(() => {
                      setContactName("");
                      setContactEmail("");
                    });
                  }}
                >
                  <div className="text-sm font-medium">Add contact</div>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Full name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                  />
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                  <button
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60"
                    disabled={saving}
                  >
                    Save contact
                  </button>
                </form>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="mb-2 text-sm font-medium">Contacts</div>
                  <div className="space-y-2 text-sm">
                    {detail.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-md border border-border p-2">
                        <div className="font-medium">{contact.full_name}</div>
                        <div className="text-xs text-muted-foreground">{contact.email || contact.phone || "-"}</div>
                      </div>
                    ))}
                    {!detail.contacts.length ? <div className="text-xs text-muted-foreground">No contacts yet.</div> : null}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="mb-2 text-sm font-medium">Recent interactions</div>
                  <div className="space-y-2 text-sm">
                    {detail.interactions.map((interaction) => (
                      <div key={interaction.id} className="rounded-md border border-border p-2">
                        {interaction.author ? (
                          <div className="mb-1">
                            <ProfileIdentity
                              handle={interaction.author.handle}
                              displayName={interaction.author.display_name || interaction.author.handle}
                              avatarUrl={interaction.author.avatar_url}
                              avatarSize={22}
                              compact
                            />
                          </div>
                        ) : null}
                        <div className="font-medium">{interaction.summary}</div>
                        <div className="text-xs text-muted-foreground">
                          {interaction.interaction_type} • {new Date(interaction.interaction_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {!detail.interactions.length ? (
                      <div className="text-xs text-muted-foreground">No interactions yet.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="mb-2 text-sm font-medium">Tasks</div>
                  <div className="space-y-2 text-sm">
                    {detail.tasks.map((task) => (
                      <div key={task.id} className="rounded-md border border-border p-2">
                        <div className="font-medium">{task.title}</div>
                        {task.assignee ? (
                          <div className="my-1">
                            <ProfileIdentity
                              handle={task.assignee.handle}
                              displayName={task.assignee.display_name || task.assignee.handle}
                              avatarUrl={task.assignee.avatar_url}
                              avatarSize={22}
                              compact
                            />
                          </div>
                        ) : null}
                        <div className="text-xs text-muted-foreground">
                          {task.status} • {task.due_at ? new Date(task.due_at).toLocaleString() : "No due date"}
                        </div>
                        {task.status === "open" ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                              type="button"
                              onClick={() => {
                                void updateTaskStatus(task.id, "done");
                              }}
                              disabled={saving}
                            >
                              Mark done
                            </button>
                            <button
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                              type="button"
                              onClick={() => {
                                void updateTaskStatus(task.id, "canceled");
                              }}
                              disabled={saving}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {!detail.tasks.length ? <div className="text-xs text-muted-foreground">No tasks yet.</div> : null}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
