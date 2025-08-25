"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";

type MarkdownProps = {
  source: string;
  className?: string;
};

export function Markdown({ source, className }: MarkdownProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className={cn("prose max-w-none prose-p:my-3 prose-li:my-1", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h3>
          ),
          p: ({ children }) => <p className="text-sm leading-[1.65]">{children}</p>,
          li: ({ children }) => <li className="text-sm leading-[1.6]">{children}</li>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 text-sm space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 text-sm space-y-1">{children}</ol>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-[12px] text-foreground">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md border border-border bg-card p-3 text-[12px]">
              {children}
            </pre>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline text-primary"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}


