import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { AuthLink } from "./AuthLink";

const navLinks = [
  { href: "/people", label: "People" },
  { href: "/modules", label: "Modules" },
];

export function Nav() {
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
          </nav>
          <AuthLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
