"use client";

import { useRef, useState } from "react";
import { MarkdownRenderer } from "@/modules/_shared/MarkdownRenderer";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  minHeightClassName?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  maxLength,
  minHeightClassName = "min-h-40",
}: MarkdownEditorProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("split");

  function setValue(next: string) {
    onChange(typeof maxLength === "number" ? next.slice(0, maxLength) : next);
  }

  function insertText(before: string, after = "", fallback = "") {
    const target = textRef.current;
    if (!target) return;

    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const content = selected || fallback;
    const next = `${value.slice(0, start)}${before}${content}${after}${value.slice(end)}`;
    const newValue = typeof maxLength === "number" ? next.slice(0, maxLength) : next;
    setValue(newValue);

    requestAnimationFrame(() => {
      target.focus();
      const cursor = Math.min(start + before.length + content.length, newValue.length);
      target.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">Markdown editor</div>
        <div className="flex flex-wrap gap-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={`rounded border px-2 py-1 ${
              viewMode === "edit" ? "border-foreground" : "border-border hover:bg-muted"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`rounded border px-2 py-1 ${
              viewMode === "split" ? "border-foreground" : "border-border hover:bg-muted"
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`rounded border px-2 py-1 ${
              viewMode === "preview" ? "border-foreground" : "border-border hover:bg-muted"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-2 text-xs">
        <button type="button" onClick={() => insertText("# ", "", "Heading")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          H1
        </button>
        <button type="button" onClick={() => insertText("## ", "", "Heading")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          H2
        </button>
        <button type="button" onClick={() => insertText("**", "**", "bold")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Bold
        </button>
        <button type="button" onClick={() => insertText("*", "*", "italic")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Italic
        </button>
        <button type="button" onClick={() => insertText("[", "](https://example.com)", "link text")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Link
        </button>
        <button type="button" onClick={() => insertText("\n- ", "", "List item")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Bullets
        </button>
        <button type="button" onClick={() => insertText("\n1. ", "", "Numbered item")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Numbered
        </button>
        <button type="button" onClick={() => insertText("\n> ", "", "Quote")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Quote
        </button>
        <button type="button" onClick={() => insertText("`", "`", "code")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Code
        </button>
        <button type="button" onClick={() => insertText("\n```\n", "\n```\n", "code block")} className="rounded border border-border px-2 py-1 hover:bg-muted">
          Code block
        </button>
      </div>

      <div className={`grid gap-3 ${viewMode === "split" ? "md:grid-cols-2" : ""}`}>
        {viewMode !== "preview" ? (
          <textarea
            ref={textRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={`${minHeightClassName} w-full rounded-lg border border-border bg-background p-3 text-sm`}
            placeholder={placeholder}
          />
        ) : null}

        {viewMode !== "edit" ? (
          <div className={`${minHeightClassName} rounded-lg border border-border bg-card p-3`}>
            {value.trim() ? (
              <MarkdownRenderer markdown={value} />
            ) : (
              <div className="text-sm text-muted-foreground">Markdown preview will appear here.</div>
            )}
          </div>
        ) : null}
      </div>

      {typeof maxLength === "number" ? (
        <div className="text-xs text-muted-foreground">
          {value.length}/{maxLength}
        </div>
      ) : null}
    </div>
  );
}
