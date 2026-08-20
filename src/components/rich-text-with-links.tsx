"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const titleRequests = new Map<string, Promise<string>>();

type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string };

export function RichTextWithLinks({ text, className = "" }: { text: string; className?: string }) {
  const parts = useMemo(() => splitText(text), [text]);
  const urls = useMemo(
    () => Array.from(new Set(parts.filter((part): part is Extract<TextPart, { type: "link" }> => part.type === "link").map((part) => part.value))).slice(0, 10),
    [parts]
  );
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setTitles({});
    void Promise.all(urls.map(async (url) => [url, await loadTitle(url)] as const)).then((entries) => {
      if (active) setTitles(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [urls]);

  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, index) => part.type === "text" ? (
        <span key={`${index}-${part.value}`}>{part.value}</span>
      ) : (
        <a
          key={`${index}-${part.value}`}
          href={part.value}
          target="_blank"
          rel="noopener noreferrer"
          title={part.value}
          className="font-medium text-apple-blue underline decoration-apple-blue/35 underline-offset-2 transition hover:decoration-apple-blue"
        >
          <ExternalLink className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
          {titles[part.value] || part.value}
        </a>
      ))}
    </span>
  );
}

function splitText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  URL_PATTERN.lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: "text", value: text.slice(cursor, index) });

    const { url, suffix } = trimTrailingPunctuation(match[0]);
    if (url) parts.push({ type: "link", value: url });
    if (suffix) parts.push({ type: "text", value: suffix });
    cursor = index + match[0].length;
  }

  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

function trimTrailingPunctuation(value: string) {
  let url = value;
  let suffix = "";
  while (/[.,;:!?\]\}]/.test(url.at(-1) ?? "")) {
    suffix = `${url.at(-1)}${suffix}`;
    url = url.slice(0, -1);
  }
  while (url.endsWith(")") && countCharacter(url, "(") < countCharacter(url, ")")) {
    suffix = `)${suffix}`;
    url = url.slice(0, -1);
  }
  return { url, suffix };
}

function countCharacter(value: string, character: string) {
  return value.split(character).length - 1;
}

function loadTitle(url: string) {
  const existing = titleRequests.get(url);
  if (existing) return existing;

  const request = fetch(`/api/link-metadata?url=${encodeURIComponent(url)}`)
    .then(async (response) => {
      if (!response.ok) return url;
      const data = await response.json() as { title?: unknown };
      return typeof data.title === "string" && data.title.trim() ? data.title.trim() : url;
    })
    .catch(() => url);
  titleRequests.set(url, request);
  return request;
}
