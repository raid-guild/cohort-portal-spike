import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";

type MarkdownRendererProps = {
  markdown: string;
  className?: string;
};

export function MarkdownRenderer({ markdown, className }: MarkdownRendererProps) {
  return (
    <div className={className ?? "space-y-4 text-sm leading-7"}>
      <ReactMarkdown
        components={{
          h1: (props) => (
            <h1 className="mb-3 mt-6 text-3xl font-semibold leading-tight first:mt-0" {...props} />
          ),
          h2: (props) => <h2 className="mb-2 mt-6 text-2xl font-semibold leading-tight" {...props} />,
          h3: (props) => <h3 className="mb-2 mt-5 text-xl font-semibold leading-tight" {...props} />,
          p: (props) => <p className="mb-4 text-sm leading-7 last:mb-0" {...props} />,
          ul: (props) => <ul className="mb-4 list-disc space-y-1 pl-6" {...props} />,
          ol: (props) => <ol className="mb-4 list-decimal space-y-1 pl-6" {...props} />,
          li: (props) => <li className="leading-7" {...props} />,
          hr: (props) => <hr className="my-8 border-0 border-t border-border" {...props} />,
          blockquote: (props) => (
            <blockquote className="mb-4 border-l-2 border-border pl-4 italic text-muted-foreground" {...props} />
          ),
          a: (props: ComponentPropsWithoutRef<"a">) => (
            <a
              {...props}
              target={props.target ?? "_blank"}
              rel={props.rel ?? "noreferrer noopener"}
              className="underline decoration-border underline-offset-2 hover:text-foreground/80"
            />
          ),
          pre: (props) => (
            <pre
              className="mb-4 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className={`rounded bg-muted px-1 py-0.5 font-mono text-xs ${props.className ?? ""}`}
              {...props}
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
