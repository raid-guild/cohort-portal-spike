"use client";

import { useMemo, useState } from "react";
import type { QuestItem } from "@/modules/cohort-hub/landing-types";

export function QuestBoard({ quests }: { quests: QuestItem[] }) {
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const merged = useMemo(
    () => quests.map((quest) => ({ ...quest, completed: quest.completed || completedIds.includes(quest.id) })),
    [completedIds, quests],
  );

  if (!quests.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Quests coming soon.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Quest Board</p>
      <ul className="mt-3 space-y-2">
        {merged.map((quest) => (
          <li
            key={quest.id}
            className="flex items-center gap-2 rounded-lg border border-border p-2 transition-colors duration-200"
          >
            <input
              id={`quest-${quest.id}`}
              type="checkbox"
              checked={quest.completed}
              onChange={() => {
                setCompletedIds((current) =>
                  current.includes(quest.id)
                    ? current.filter((id) => id !== quest.id)
                    : [...current, quest.id],
                );
              }}
              className="h-4 w-4"
            />
            <label htmlFor={`quest-${quest.id}`} className="text-sm">
              {quest.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
