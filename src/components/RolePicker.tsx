"use client";

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
  const toggleRole = (name: string) => {
    if (value.includes(name)) {
      onChange(value.filter((item) => item !== name));
      return;
    }
    if (value.length >= maxSelected) {
      return;
    }
    onChange([...value, name]);
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Select up to {maxSelected} roles (primary + secondary).
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const active = value.includes(role.name);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => toggleRole(role.name)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left ${
                active
                  ? "border-primary bg-primary/10"
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
    </div>
  );
}
