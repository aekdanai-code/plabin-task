"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Underline, List, ListOrdered, Link2, RemoveFormatting, Undo2, Redo2 } from "lucide-react";
import { safeTaskLink, taskRichTextPlain, TASK_DESCRIPTION_MAX_LENGTH, type RichTextNode } from "@/lib/task-rich-text";

export function TaskRichTextEditor({ initialValue, disabled, onChange }: { initialValue: RichTextNode; disabled: boolean; onChange: (doc: RichTextNode) => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [2, 3] }, code: false, codeBlock: false, horizontalRule: false, strike: false,
      link: { openOnClick: false, defaultProtocol: "https", protocols: ["http", "https"], isAllowedUri: url => Boolean(safeTaskLink(url)) }
    })],
    content: initialValue,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "task-rich-text min-h-44 px-4 py-3 text-sm leading-6 focus:outline-none", role: "textbox", "aria-label": "รายละเอียด Task", "aria-multiline": "true" } },
    onUpdate: ({ editor: next }) => onChange(next.getJSON() as RichTextNode)
  });
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  const count = taskRichTextPlain((editor?.getJSON() ?? initialValue) as RichTextNode).length;
  const commands = [
    { label: "ตัวหนา", icon: Bold, active: editor?.isActive("bold"), run: () => editor?.chain().focus().toggleBold().run() },
    { label: "ตัวเอียง", icon: Italic, active: editor?.isActive("italic"), run: () => editor?.chain().focus().toggleItalic().run() },
    { label: "ขีดเส้นใต้", icon: Underline, active: editor?.isActive("underline"), run: () => editor?.chain().focus().toggleUnderline().run() },
    { label: "รายการหัวข้อย่อย", icon: List, active: editor?.isActive("bulletList"), run: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "รายการลำดับเลข", icon: ListOrdered, active: editor?.isActive("orderedList"), run: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: "เพิ่มหรือแก้ไขลิงก์", icon: Link2, active: editor?.isActive("link"), run: () => { setLinkValue(editor?.getAttributes("link").href ?? ""); setLinkError(""); setLinkOpen(true); } },
    { label: "ล้างรูปแบบ", icon: RemoveFormatting, run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
    { label: "เลิกทำ", icon: Undo2, run: () => editor?.chain().focus().undo().run() },
    { label: "ทำซ้ำ", icon: Redo2, run: () => editor?.chain().focus().redo().run() }
  ];
  return <div>
    <div className="rounded-lg border border-apple-line focus-within:border-apple-blue">
      <div className="flex flex-wrap gap-1 rounded-t-lg border-b border-apple-line bg-apple-bg p-2" role="group" aria-label="จัดรูปแบบรายละเอียด">
        <button type="button" disabled={disabled || !editor} aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className="rounded-md px-3 py-2 text-sm hover:bg-white aria-pressed:bg-apple-blue/10 aria-pressed:text-apple-blue">หัวข้อ</button>
        {commands.map(({ label, icon: Icon, active, run }) => <button key={label} type="button" disabled={disabled || !editor} title={label} aria-label={label} aria-pressed={active ?? false} onMouseDown={e => e.preventDefault()} onClick={run} className="rounded-md p-2 hover:bg-white aria-pressed:bg-apple-blue/10 aria-pressed:text-apple-blue disabled:opacity-40"><Icon className="h-4 w-4" /></button>)}
      </div>
      <EditorContent editor={editor} />
    </div>
    {linkOpen ? <div className="mt-2 rounded-lg bg-apple-bg p-3">
      <label className="text-sm">URL ของลิงก์<input type="url" value={linkValue} onChange={e => setLinkValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} placeholder="https://example.com" className="mt-1 w-full rounded-md border border-apple-line px-3 py-2" /></label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="rounded-md bg-apple-blue px-3 py-2 text-sm text-white" onClick={() => { const href = safeTaskLink(linkValue); if (!href) { setLinkError("กรุณาใส่ลิงก์ http:// หรือ https://"); return; } if (editor?.state.selection.empty) editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run(); else editor?.chain().focus().extendMarkRange("link").setLink({ href }).run(); setLinkOpen(false); }}>ใช้ลิงก์</button>
        <button type="button" className="rounded-md bg-white px-3 py-2 text-sm" onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); }}>นำลิงก์ออก</button>
        <button type="button" className="px-3 py-2 text-sm" onClick={() => setLinkOpen(false)}>ยกเลิก</button>
      </div>{linkError ? <p role="alert" className="mt-2 text-sm text-apple-red">{linkError}</p> : null}
    </div> : null}
    <p className={`mt-2 text-right text-xs ${count > TASK_DESCRIPTION_MAX_LENGTH ? "text-apple-red" : "text-apple-muted"}`} aria-live="polite">{count.toLocaleString()} / 2,000 ตัวอักษร</p>
  </div>;
}
