"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";

type ReferralItem = {
  id: string;
  email: string;
  referral: string | null;
  createdAt: string | null;
  hasAccount: boolean;
};

type ListResponse = {
  items: ReferralItem[];
  nextCursor: string | null;
  error?: string;
};

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

export function SignupReferrals() {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [token, setToken] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const isHost = roles.includes("host") || roles.includes("admin");

  const [q, setQ] = useState("");
  const [committedQ, setCommittedQ] = useState("");
  const [status, setStatus] = useState<"all" | "converted" | "not_converted">("all");
  const [limit, setLimit] = useState(50);

  const [cursor, setCursor] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [items, setItems] = useState<ReferralItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!cancelled) setRolesLoaded(false);

      const { data } = await supabase.auth.getSession();
      const sessionToken = data.session?.access_token ?? null;
      if (!cancelled) setToken(sessionToken);

      if (!sessionToken) {
        if (!cancelled) {
          setRoles([]);
          setRolesLoaded(true);
        }
        return;
      }

      try {
        const rolesRes = await fetch("/api/me/roles", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        if (!rolesRes.ok) {
          if (!cancelled) {
            setRoles([]);
            setRolesLoaded(true);
          }
          return;
        }

        const rolesJson = await rolesRes.json();
        if (!cancelled) {
          setRoles(rolesJson.roles ?? []);
          setRolesLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setRoles([]);
          setRolesLoaded(true);
        }
      }
    };

    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      load();
      setCursor(0);
      setSelected({});
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const loadReferrals = async (authToken: string, opts: { cursor: number; q: string }) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("cursor", String(opts.cursor));
    if (opts.q.trim()) params.set("q", opts.q.trim());
    if (status !== "all") params.set("status", status);

    const res = await fetch(`/api/modules/signup-referrals?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const json = await readJsonSafe<ListResponse>(res);
    if (!res.ok) {
      throw new Error(json?.error || `Failed to load referrals (HTTP ${res.status}).`);
    }

    setItems(json?.items ?? []);
    setNextCursor(json?.nextCursor ?? null);
  };

  useEffect(() => {
    if (!token) return;
    setMessage("");
    setLoading(true);
    loadReferrals(token, { cursor, q: committedQ })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, cursor, limit, status, committedQ]);

  const onSearch = async () => {
    if (!token) return;
    const nextQ = q.trim();
    setCommittedQ(nextQ);
    setCursor(0);
    setSelected({});
    setMessage("");
    setLoading(true);
    try {
      await loadReferrals(token, { cursor: 0, q: nextQ });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = () => {
    const allSelected = items.length > 0 && items.every((row) => selected[row.id]);
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of items) next[row.id] = true;
    setSelected(next);
  };

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const exportCsv = async () => {
    if (!token) return;
    if (!selectedIds.length) return;
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/modules/signup-referrals/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: selectedIds, format: "csv" }),
      });

      if (!res.ok) {
        const json = await readJsonSafe<{ error?: string }>(res);
        throw new Error(json?.error || `Export failed (HTTP ${res.status}).`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "signup-referrals.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setMessage("Export started.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Signup Referrals</h1>
        <p>Please sign in.</p>
      </div>
    );
  }

  if (!rolesLoaded) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Signup Referrals</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Signup Referrals</h1>
        <p>Host access required.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Signup Referrals</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Selected: {selectedIds.length}</div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 12,
          marginBottom: 12,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email/referral"
          style={{ padding: 8, minWidth: 220 }}
        />
        <button onClick={onSearch} disabled={loading} style={{ padding: "8px 12px" }}>
          Search
        </button>

        <select
          value={status}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "all" || next === "converted" || next === "not_converted") {
              setStatus(next);
              setCursor(0);
              setSelected({});
            }
          }}
          style={{ padding: 8 }}
        >
          <option value="all">All</option>
          <option value="converted">Converted</option>
          <option value="not_converted">Not Converted</option>
        </select>

        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setCursor(0);
            setSelected({});
          }}
          style={{ padding: 8 }}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>

        <button
          onClick={exportCsv}
          disabled={loading || selectedIds.length === 0}
          style={{ padding: "8px 12px" }}
        >
          Export CSV
        </button>
      </div>

      {message ? (
        <div style={{ marginBottom: 12, color: message.toLowerCase().includes("failed") ? "#b91c1c" : "#065f46" }}>
          {message}
        </div>
      ) : null}

      {loading ? <div style={{ marginBottom: 12 }}>Loading…</div> : null}

      {items.length === 0 && !loading ? <div>No referrals found.</div> : null}

      {items.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>
                  <input
                    type="checkbox"
                    onChange={toggleAll}
                    checked={items.length > 0 && items.every((row) => selected[row.id])}
                  />
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Referral</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Created</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[row.id])}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>{row.email}</td>
                  <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>{row.referral ?? ""}</td>
                  <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>{formatDate(row.createdAt)}</td>
                  <td style={{ borderBottom: "1px solid #f3f4f6", padding: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: row.hasAccount ? "#dcfce7" : "#fee2e2",
                        color: row.hasAccount ? "#166534" : "#991b1b",
                        fontSize: 12,
                      }}
                    >
                      {row.hasAccount ? "Has account" : "No account"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          onClick={() => {
            setCursor((prev) => Math.max(0, prev - limit));
            setSelected({});
          }}
          disabled={loading || cursor === 0}
          style={{ padding: "8px 12px" }}
        >
          Prev
        </button>
        <button
          onClick={() => {
            if (!nextCursor) return;
            setCursor(Number(nextCursor));
            setSelected({});
          }}
          disabled={loading || !nextCursor}
          style={{ padding: "8px 12px" }}
        >
          Next
        </button>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Offset: {cursor}</span>
      </div>
    </div>
  );
}
