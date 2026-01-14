import fs from "node:fs";
import path from "node:path";
import type { ModuleEntry, Registry } from "./types";

const registryPath = path.join(process.cwd(), "modules", "registry.json");

export function loadRegistry(): Registry {
  const raw = fs.readFileSync(registryPath, "utf-8");
  return JSON.parse(raw) as Registry;
}

export function getModules(): ModuleEntry[] {
  return loadRegistry().modules.filter((mod) => mod.status === "live");
}

export function getModuleById(id: string): ModuleEntry | undefined {
  return getModules().find((mod) => mod.id === id);
}
