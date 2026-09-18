import { Fragment, type ReactNode } from "react";
import { RichTextWithLinks } from "@/components/rich-text-with-links";
import { normalizeTaskRichText, safeTaskLink, type RichTextNode } from "@/lib/task-rich-text";

function renderNode(node: RichTextNode): ReactNode {
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      if (mark.type === "italic") text = <em>{text}</em>;
      if (mark.type === "underline") text = <u>{text}</u>;
      if (mark.type === "link") {
        const href = safeTaskLink(mark.attrs?.href);
        if (href) text = <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>;
      }
    }
    return text;
  }
  const content = node.content?.map((child, index) => <Fragment key={index}>{renderNode(child)}</Fragment>);
  switch (node.type) {
    case "doc": return content;
    case "paragraph": return <p>{content?.length ? content : <br />}</p>;
    case "heading": return node.attrs?.level === 3 ? <h3>{content}</h3> : <h2>{content}</h2>;
    case "bulletList": return <ul>{content}</ul>;
    case "orderedList": return <ol start={Number(node.attrs?.start ?? 1)}>{content}</ol>;
    case "listItem": return <li>{content}</li>;
    case "blockquote": return <blockquote>{content}</blockquote>;
    case "hardBreak": return <br />;
    default: return null;
  }
}

export function TaskRichText({ document, fallback }: { document?: unknown; fallback: string | null }) {
  let content: RichTextNode | null = null;
  try { if (document) content = normalizeTaskRichText(document); } catch { /* Invalid documents render as safe plain text. */ }
  return <div className="task-rich-text text-sm leading-6 text-apple-text">{content ? renderNode(content) : fallback ? <RichTextWithLinks text={fallback} /> : <p className="text-apple-muted">ไม่มีรายละเอียดเพิ่มเติม</p>}</div>;
}
