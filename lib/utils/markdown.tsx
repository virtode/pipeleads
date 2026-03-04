import type React from 'react'

/**
 * Lightweight inline markdown renderer.
 * Handles bold, italic, headers (## / ###), bullet lists, and links.
 * No external dependency.
 */

function inlineFormat(text: string): React.ReactNode {
  // Split on **bold**, *italic*, and [link](url)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {linkMatch[1]}
        </a>
      )
    }
    return part
  })
}

export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let listBuffer: string[] = []
  let key = 0

  function flushList() {
    if (listBuffer.length > 0) {
      nodes.push(
        <ul key={key++} className="my-1.5 space-y-0.5 pl-4">
          {listBuffer.map((item, i) => (
            <li key={i} className="flex gap-1.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      nodes.push(
        <p key={key++} className={`mt-3 mb-1 font-semibold ${level === 2 ? 'text-sm' : 'text-xs uppercase tracking-wide text-muted-foreground'}`}>
          {inlineFormat(headingMatch[2])}
        </p>
      )
      continue
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/)
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1])
      continue
    }

    flushList()

    if (line.trim() === '') {
      nodes.push(<div key={key++} className="h-1" />)
    } else {
      nodes.push(
        <p key={key++} className="text-sm leading-relaxed">{inlineFormat(line)}</p>
      )
    }
  }

  flushList()
  return nodes
}
