"use client";

import { useEffect, useState } from "react";
import type { RaidGuildRole } from "@/lib/raidguild-roles";

type RolePickerProps = {
  roles: RaidGuildRole[];
  value: string[];
  onChange: (next: string[]) => void;
  maxSelected?: number;
};

export function RolePicker({
  roles,
  value,
  onChange,
  maxSelected = 2,
}: RolePickerProps) {
  const [limitNotice, setLimitNotice] = useState("");

  useEffect(() => {
    if (value.length < maxSelected) {
      setLimitNotice("");
    }
  }, [maxSelected, value.length]);

  const toggleRole = (name: string) => {
    if (value.includes(name)) {
      onChange(value.filter((item) => item !== name));
      setLimitNotice("");
      return;
    }
    if (value.length >= maxSelected) {
      setLimitNotice(
        `You already selected ${maxSelected} roles. Unselect one below to choose a different role.`,
      );
      return;
    }
    onChange([...value, name]);
    setLimitNotice("");
  };

  const removeRole = (name: string) => {
    onChange(value.filter((item) => item !== name));
    setLimitNotice("");
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Select up to {maxSelected} roles (primary + secondary).
      </div>
      {value.length ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Selected ({value.length}/{maxSelected})
          </div>
          <div className="flex flex-wrap gap-2">
            {value.map((roleName) => (
              <button
                key={roleName}
                type="button"
                onClick={() => removeRole(roleName)}
                className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-foreground hover:bg-primary/20"
              >
                {roleName} ×
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const active = value.includes(role.name);
          const blocked = !active && value.length >= maxSelected;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => toggleRole(role.name)}
              aria-disabled={blocked}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left ${
                active
                  ? "border-primary bg-primary/10"
                  : blocked
                    ? "cursor-not-allowed border-border bg-background opacity-60"
                    : "border-border bg-background hover:bg-muted"
              }`}
            >
              {role.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={role.icon}
                  alt=""
                  className="h-10 w-10 flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 flex-shrink-0 rounded-full border border-border bg-muted" />
              )}
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">{role.name}</div>
                <div className="text-xs text-muted-foreground">{role.type}</div>
                <div className="text-xs text-muted-foreground">{role.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      {value.length >= maxSelected ? (
        <div className="text-xs text-muted-foreground">
          Max roles selected. Unselect one to choose another.
        </div>
      ) : null}
      {limitNotice ? <div className="text-xs text-amber-600">{limitNotice}</div> : null}
    </div>
  );
}
