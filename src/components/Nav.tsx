"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { ThemeToggle } from "./ThemeToggle";
import { AuthLink } from "./AuthLink";

const navLinks = [
  { href: "/people", label: "People" },
  { href: "/modules", label: "Modules" },
];

export function Nav() {
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
          rolesRes.ok ? rolesRes.json().catch(() => null) : null,
          entitlementsRes.ok ? entitlementsRes.json().catch(() => null) : null,
        ]);

        if (cancelled) return;
        const roles = (rolesJson?.roles ?? []) as string[];
        const entitlements = (entitlementsJson?.entitlements ?? []) as string[];
        setIsHost(roles.includes("host"));
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

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <div className="container-custom flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold">
          Cohort Portal
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <nav className="flex flex-wrap gap-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:underline">
                {link.label}
              </Link>
            ))}
            {isHost ? (
              <Link href="/host" className="hover:underline">
                Host
              </Link>
            ) : null}
            {isDaoMember ? (
              <Link href="/member" className="hover:underline">
                Member
              </Link>
            ) : null}
          </nav>
          <AuthLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
