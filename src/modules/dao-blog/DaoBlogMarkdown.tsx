import { MarkdownRenderer } from "@/modules/_shared/MarkdownRenderer";

type DaoBlogMarkdownProps = {
  markdown: string;
  className?: string;
};

export function DaoBlogMarkdown({ markdown, className }: DaoBlogMarkdownProps) {
  return <MarkdownRenderer markdown={markdown} className={className} />;
}
