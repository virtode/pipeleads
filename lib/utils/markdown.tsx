'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
    <ReactMarkdown
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-sm border-collapse">
              {children}
            </table>
          </div>
        ),
        td: ({ children }) => (
          <td className="border border-border px-2 py-1 break-all text-sm">
            {children}
          </td>
        ),
        th: ({ children }) => (
          <th className="border border-border px-2 py-1 bg-muted font-medium text-left text-sm">
            {children}
          </th>
        ),
        h2: ({ children }) => (
          <p className="mt-3 mb-1 font-semibold text-sm">{children}</p>
        ),
        h3: ({ children }) => (
          <p className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="my-1.5 space-y-0.5 pl-4 list-none">{children}</ul>
        ),
        li: ({ children }) => (
          <li className="flex gap-1.5 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
            <span>{children}</span>
          </li>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
