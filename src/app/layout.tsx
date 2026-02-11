import type { Metadata } from "next";
import { Suspense } from "react";
import { NavShell } from "@/components/NavShell";
import { PortalToastHost } from "@/components/PortalToastHost";
import { ebGaramond, maziusDisplay, ubuntuMono } from "@/lib/fonts";
import { ThemeProvider } from "@/lib/theme-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "RaidGuild Cohort Portal",
  description:
    "Directory-first cohort portal for profiles, modules, learning, and project activity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${maziusDisplay.variable} ${ebGaramond.variable} ${ubuntuMono.variable} bg-background text-foreground antialiased`}
      >
        <ThemeProvider>
          <Suspense fallback={null}>
            <NavShell />
          </Suspense>
          <PortalToastHost />
          <main className="container-custom py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
