"use client";

import { useMemo } from "react";
import { ProfileIdentity } from "./ProfileIdentity";

export type ProfileOption = {
  userId?: string | null;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
};

export function ProfileMultiSelect({
  options,
  selectedHandles,
  inputValue,
  onInputValueChange,
  onAddHandle,
  onRemoveHandle,
  label = "Profiles",
  placeholder = "Type a handle",
  datalistId = "profile-multi-select-options",
  disabled = false,
}: {
  options: ProfileOption[];
  selectedHandles: string[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onAddHandle: (handle: string) => void;
  onRemoveHandle: (handle: string) => void;
  label?: string;
  placeholder?: string;
  datalistId?: string;
  disabled?: boolean;
}) {
  const suggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];
    return options
      .filter((option) => !selectedHandles.includes(option.handle))
      .filter(
        (option) =>
          option.handle.toLowerCase().includes(query) ||
          option.displayName.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [inputValue, options, selectedHandles]);

  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">{label}</label>
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={inputValue}
        list={datalistId}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => onInputValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            onAddHandle(inputValue);
          }
        }}
        placeholder={placeholder}
      />
      <datalist id={datalistId}>
        {options.map((option) => (
          <option key={option.handle} value={option.handle}>
            {option.displayName}
          </option>
        ))}
      </datalist>

      {suggestions.length ? (
        <div className="space-y-1 rounded-lg border border-border bg-card p-2">
          {suggestions.map((option) => (
            <button
              key={option.handle}
              type="button"
              className="w-full rounded-md px-2 py-1 text-left hover:bg-muted"
              onClick={() => onAddHandle(option.handle)}
              disabled={disabled}
            >
              <ProfileIdentity
                handle={option.handle}
                displayName={option.displayName}
                avatarUrl={option.avatarUrl}
                avatarSize={28}
                compact
              />
            </button>
          ))}
        </div>
      ) : null}

      {selectedHandles.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedHandles.map((handle) => (
            <button
              key={handle}
              type="button"
              className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted"
              onClick={() => onRemoveHandle(handle)}
              disabled={disabled}
              title="Remove"
            >
              @{handle} x
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
