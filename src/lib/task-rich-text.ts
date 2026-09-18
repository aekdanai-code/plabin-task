export type RichTextNode = {
  type: string;
  text?: string;
  content?: RichTextNode[];
  attrs?: Record<string, string | number>;
  marks?: Array<{ type: string; attrs?: Record<string, string> }>;
};

export const TASK_DESCRIPTION_MAX_LENGTH = 2000;
const blocks = ["paragraph", "heading", "bulletList", "orderedList", "blockquote"];
const children: Record<string, string[]> = {
  doc: blocks,
  paragraph: ["text", "hardBreak"],
  heading: ["text", "hardBreak"],
  bulletList: ["listItem"],
  orderedList: ["listItem"],
  listItem: blocks,
  blockquote: blocks,
  text: [],
  hardBreak: []
};

export function safeTaskLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

// Validate and rebuild a bounded document; never accept arbitrary HTML or attributes.
export function normalizeTaskRichText(input: unknown): RichTextNode {
  if (JSON.stringify(input)?.length > 50000) throw new Error("รายละเอียดมีขนาดใหญ่เกินไป");
  let count = 0;
  function visit(value: unknown, depth: number, allowed: string[]): RichTextNode {
    if (!value || typeof value !== "object" || Array.isArray(value) || depth > 12 || ++count > 1500) throw new Error("รูปแบบรายละเอียดไม่ถูกต้อง");
    const node = value as Record<string, unknown>;
    if (typeof node.type !== "string" || !allowed.includes(node.type)) throw new Error("รูปแบบรายละเอียดไม่รองรับ");
    const result: RichTextNode = { type: node.type };
    if (node.type === "text") {
      if (typeof node.text !== "string" || !node.text) throw new Error("ข้อความไม่ถูกต้อง");
      result.text = node.text;
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) throw new Error("รูปแบบรายละเอียดไม่ถูกต้อง");
      result.content = node.content.map(child => visit(child, depth + 1, children[node.type as string]));
    }
    if (["bulletList", "orderedList", "listItem", "blockquote"].includes(node.type) && !result.content?.length) throw new Error("รายการต้องมีข้อความ");
    if (node.type === "listItem" && result.content?.[0]?.type !== "paragraph") throw new Error("รูปแบบรายการไม่ถูกต้อง");
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (node.type === "heading") result.attrs = { level: attrs?.level === 3 ? 3 : 2 };
    if (node.type === "orderedList") result.attrs = { start: typeof attrs?.start === "number" && Number.isInteger(attrs.start) && attrs.start > 0 && attrs.start < 10000 ? attrs.start : 1 };
    if (node.marks !== undefined) {
      if (node.type !== "text" || !Array.isArray(node.marks) || node.marks.length > 4) throw new Error("รูปแบบข้อความไม่ถูกต้อง");
      result.marks = node.marks.map(mark => {
        if (!["bold", "italic", "underline", "link"].includes(mark?.type)) throw new Error("รูปแบบข้อความไม่รองรับ");
        if (mark.type === "link") {
          const href = safeTaskLink(mark.attrs?.href);
          if (!href) throw new Error("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");
          return { type: "link", attrs: { href } };
        }
        return { type: mark.type };
      });
    }
    return result;
  }
  const doc = visit(input, 0, ["doc"]);
  if (taskRichTextPlain(doc).length > TASK_DESCRIPTION_MAX_LENGTH) throw new Error("รายละเอียดต้องไม่เกิน 2,000 ตัวอักษร");
  return doc;
}

export function taskRichTextPlain(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const inline = node.type === "paragraph" || node.type === "heading";
  return (node.content ?? []).map(taskRichTextPlain).join(inline ? "" : "\n");
}

export function plainTextDocument(text: string): RichTextNode {
  return { type: "doc", content: text.split("\n").map(line => ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })) };
}

export function initialTaskDocument(rich: unknown, plain: string | null): RichTextNode {
  if (rich) { try { return normalizeTaskRichText(rich); } catch { /* Preserve the readable legacy fallback. */ } }
  return plainTextDocument(plain ?? "");
}
