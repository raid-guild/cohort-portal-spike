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
    let requestSeq = 0;

    const loadAccess = async () => {
      const seq = ++requestSeq;
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        if (cancelled || seq !== requestSeq) return;
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

        if (cancelled || seq !== requestSeq) return;
        const roles = (rolesJson?.roles ?? []) as string[];
        const entitlements = (entitlementsJson?.entitlements ?? []) as string[];
        setIsHost(roles.includes("host") || roles.includes("admin"));
        setIsDaoMember(entitlements.includes("dao-member"));
      } catch {
        if (cancelled || seq !== requestSeq) return;
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
    <div className="container-custom py-4 md:py-6">
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
            <Link href="/" className="text-base font-semibold">
              Cohort Portal
            </Link>
            <nav className="mt-4 space-y-1 text-sm">
              {links.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block rounded-lg px-3 py-2 ${
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <header className="rounded-2xl border border-border bg-card/80 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cohort Portal
                </div>
                <div className="truncate text-base font-semibold">{activeLabel}</div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <AuthLink />
              </div>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto text-sm lg:hidden">
              {links.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 ${
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
          </header>

          <main className="pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
