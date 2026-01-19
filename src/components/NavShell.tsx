"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Nav } from "./Nav";

export function NavShell() {
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isEmbed = params.get("embed") === "1";
  if (isEmbed) {
    return null;
  }
  return <Nav />;
}
