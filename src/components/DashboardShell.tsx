"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { AuthLink } from "./AuthLink";
import { ThemeToggle } from "./ThemeToggle";

const baseLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/people", label: "People" },
  { href: "/modules", label: "Modules" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const [isHost, setIsHost] = useState(false);
  const [isDaoMember, setIsDaoMember] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        if (cancelled) return;
        setIsHost(false);
        setIsDaoMember(false);
        return;
      }

      try {
        const [rolesRes, entitlementsRes] = await Promise.all([
          fetch("/api/me/roles", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch("/api/me/entitlements", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        const [rolesJson, entitlementsJson] = await Promise.all([
          rolesRes.json().catch(() => null),
          entitlementsRes.json().catch(() => null),
        ]);

        if (cancelled) return;
        const roles = (rolesJson?.roles ?? []) as string[];
        const entitlements = (entitlementsJson?.entitlements ?? []) as string[];
        setIsHost(roles.includes("host") || roles.includes("admin"));
        setIsDaoMember(entitlements.includes("dao-member"));
      } catch {
        if (cancelled) return;
        setIsHost(false);
        setIsDaoMember(false);
      }
    };

    void loadAccess();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void loadAccess();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const isEmbed = params.get("embed") === "1";
  if (isEmbed) {
    return <main className="py-0">{children}</main>;
  }

  const links = [...baseLinks];
  if (isHost) {
    links.push({ href: "/host", label: "Host" });
  }
  if (isDaoMember) {
    links.push({ href: "/member", label: "Member" });
  }

  const activeLabel =
    links.find((link) =>
      link.href === "/"
        ? pathname === "/"
        : pathname === link.href || pathname.startsWith(`${link.href}/`),
    )?.label ?? "Dashboard";

  return (
    <div className="w-full px-4 py-4 md:px-6 md:py-6 xl:px-8">
      <div className="min-w-0 space-y-4">
        <header className="rounded-2xl border border-border bg-card/80 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Cohort Portal
              </div>
              <div className="truncate text-base font-semibold">{activeLabel}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <ThemeToggle />
              <AuthLink />
              <nav className="flex flex-wrap items-center gap-2">
                {links.map((link) => {
                  const active =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`rounded-full border px-3 py-1.5 ${
                        active
                          ? "border-primary text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>

        <main className="pb-8">{children}</main>
      </div>
    </div>
  );
}
