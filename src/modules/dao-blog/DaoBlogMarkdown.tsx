import { MarkdownRenderer } from "@/modules/_shared/MarkdownRenderer";

type DaoBlogMarkdownProps = {
  markdown: string;
  className?: string;
};

export function DaoBlogMarkdown({ markdown, className }: DaoBlogMarkdownProps) {
  const baseClass = "space-y-4 text-sm leading-7 font-sans";
  return (
    <MarkdownRenderer
      markdown={markdown}
      className={className ? `${baseClass} ${className}` : baseClass}
    />
  );
}
