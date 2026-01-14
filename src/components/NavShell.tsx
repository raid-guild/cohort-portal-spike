"use client";

import { useSearchParams } from "next/navigation";
import { Nav } from "./Nav";

export function NavShell() {
  const params = useSearchParams();
  const isEmbed = params.get("embed") === "1";
  if (isEmbed) {
    return null;
  }
  return <Nav />;
}
