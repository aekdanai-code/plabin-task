"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, CheckCircle2, ListChecks, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { addChecklistNote, toggleChecklistItem, updateChecklistNote } from "@/actions/checklist-actions";
import type { ChecklistItem } from "@/types/app";

export function ChecklistEditor({
  items,
  canCheck,
  taskId,
  userId,
  onRowsChange
}: {
  items: ChecklistItem[];
  canCheck: boolean;
  taskId: string;
  userId: string;
  onRowsChange?: (items: ChecklistItem[]) => void;
}) {
  const [rows, setRows] = useState(items);
  const [filter, setFilter] = useState<"ALL" | "PENDING">("ALL");
  const [noteEditorItemId, setNoteEditorItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const rowsRef = useRef(items);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const filterStorageKey = `plabin:checklist-view:v1:${userId}:${taskId}`;
  const pendingCount = useMemo(() => rows.filter((item) => !item.is_checked).length, [rows]);
  const noteCount = useMemo(
    () => rows.filter((item) => (item.checklist_notes?.length ?? 0) > 0).length,
    [rows]
  );
  const filteredRows = useMemo(
    () => filter === "PENDING" ? rows.filter((item) => !item.is_checked) : rows,
    [filter, rows]
  );

  useEffect(() => {
    rowsRef.current = items;
    setRows(items);
  }, [items]);

  useEffect(() => {
    setFilter("ALL");
    try {
      const savedFilter = window.localStorage.getItem(filterStorageKey);
      if (savedFilter === "PENDING") setFilter("PENDING");
    } catch {
      // localStorage can be unavailable in private or restricted browser modes.
    }
  }, [filterStorageKey]);

  useEffect(() => {
    if (noteEditorItemId) noteInputRef.current?.focus();
  }, [noteEditorItemId]);

  function changeFilter(nextFilter: "ALL" | "PENDING") {
    setFilter(nextFilter);
    try {
      window.localStorage.setItem(filterStorageKey, nextFilter);
    } catch {
      // Keep the current-session filter even when the browser cannot persist it.
    }
  }

  function commitRows(nextRows: ChecklistItem[]) {
    rowsRef.current = nextRows;
    setRows(nextRows);
    onRowsChange?.(nextRows);
  }

  function openNoteEditor(itemId: string, currentContent = "") {
    if (!canCheck || savingNote) return;
    setNoteEditorItemId(itemId);
    setNoteDraft(currentContent);
  }

  function closeNoteEditor() {
    if (savingNote) return;
    setNoteEditorItemId(null);
    setNoteDraft("");
  }

  async function saveNote(itemId: string) {
    if (savingNote) return;
    const content = noteDraft.trim();
    if (!content) {
      toast.error("กรุณาระบุหมายเหตุ");
      noteInputRef.current?.focus();
      return;
    }

    setSavingNote(true);
    const row = rowsRef.current.find((item) => item.id === itemId);
    const existingNote = row?.checklist_notes?.[0];
    const result = existingNote
      ? await updateChecklistNote(existingNote.id, { content })
      : await addChecklistNote(itemId, { content });
    if (!result.ok) {
      toast.error(result.message);
      setSavingNote(false);
      noteInputRef.current?.focus();
      return;
    }

    commitRows(
      rowsRef.current.map((row) =>
        row.id === itemId
          ? { ...row, checklist_notes: [result.data] }
          : row
      )
    );
    setSavingNote(false);
    setNoteEditorItemId(null);
    setNoteDraft("");
    toast.success(result.message);
  }

  function handleNoteKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, itemId: string) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeNoteEditor();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void saveNote(itemId);
    }
  }

  async function toggle(item: ChecklistItem) {
    if (!canCheck || pendingRef.current.has(item.id)) return;
    const nextChecked = !item.is_checked;
    pendingRef.current.add(item.id);
    setPendingIds(Array.from(pendingRef.current));
    commitRows(rowsRef.current.map((row) => (row.id === item.id ? { ...row, is_checked: nextChecked } : row)));

    const result = await toggleChecklistItem(item.id, nextChecked, crypto.randomUUID());
    if (!result.ok) {
      commitRows(rowsRef.current.map((row) => (row.id === item.id ? item : row)));
      toast.error(result.message);
    } else {
      commitRows(rowsRef.current.map((row) => (row.id === item.id ? { ...row, ...result.data } : row)));
    }
    pendingRef.current.delete(item.id);
    setPendingIds(Array.from(pendingRef.current));
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-apple-muted">
          รอตรวจ {pendingCount} จาก {rows.length} รายการ
          {noteCount > 0 ? <span> · {noteCount} หมายเหตุ</span> : null}
        </p>
        <div className="inline-flex w-fit rounded-lg bg-apple-bg p-1" role="group" aria-label="เลือกการแสดง Checklist">
          <FilterButton
            active={filter === "ALL"}
            icon={<ListChecks className="h-3.5 w-3.5" />}
            label="ทั้งหมด"
            count={rows.length}
            onClick={() => changeFilter("ALL")}
          />
          <FilterButton
            active={filter === "PENDING"}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="ยังไม่ได้เช็ก"
            count={pendingCount}
            onClick={() => changeFilter("PENDING")}
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-apple-line bg-apple-bg/60 px-4 py-7 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-apple-green" />
          <p className="mt-2 text-sm font-medium text-apple-text">ไม่มีรายการที่รอเช็ก</p>
          <p className="mt-1 text-xs text-apple-muted">Checklist ของ Task นี้ถูกเช็กครบแล้ว</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRows.map((item) => {
            const note = item.checklist_notes?.[0];
            const editorOpen = noteEditorItemId === item.id;
            return (
              <div key={item.id} className="group rounded-lg bg-apple-bg p-3">
              <div className="flex w-full items-center gap-3">
                <button
                  type="button"
                  disabled={!canCheck || pendingIds.includes(item.id)}
                  onClick={() => void toggle(item)}
                  aria-label={`${item.is_checked ? "ยกเลิกการตรวจ" : "ตรวจแล้ว"}: ${item.item_name}`}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition disabled:cursor-default disabled:opacity-60 ${
                    item.is_checked ? "border-apple-green bg-apple-green text-white" : "border-apple-line bg-white"
                  }`}
                >
                  {item.is_checked ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
                <span className={`min-w-0 flex-1 text-sm ${item.is_checked ? "text-apple-muted line-through" : "text-apple-text"}`}>
                  {item.item_name}
                </span>
                {canCheck && !editorOpen ? (
                  <button
                    type="button"
                    onClick={() => openNoteEditor(item.id, note?.content)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-apple-line bg-white px-2.5 py-1.5 text-xs font-medium text-apple-text opacity-100 transition hover:border-apple-blue/40 hover:text-apple-blue sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    {note ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {note ? "แก้ไขหมายเหตุ" : "เพิ่มหมายเหตุ"}
                  </button>
                ) : null}
                <span className="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-medium text-apple-muted">W {item.weight}</span>
              </div>

              {note && !editorOpen ? (
                <div className="ml-8 mt-2 border-l-2 border-apple-line pl-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-5 text-apple-muted">{note.content}</p>
                    <p className="shrink-0 text-[11px] text-apple-muted/80">
                      {note.author?.display_name || note.author?.email || "สมาชิกในทีม"} · {formatNoteTime(note.updated_at || note.created_at)}
                    </p>
                  </div>
                </div>
              ) : null}

              {editorOpen ? (
                <div className="ml-8 mt-3">
                  <textarea
                    ref={noteInputRef}
                    value={noteDraft}
                    maxLength={2000}
                    rows={3}
                    disabled={savingNote}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    onKeyDown={(event) => handleNoteKeyDown(event, item.id)}
                    placeholder="พิมพ์หมายเหตุ... (Enter เพื่อบันทึก, Shift+Enter ขึ้นบรรทัดใหม่)"
                    className="w-full resize-y rounded-lg border border-apple-green bg-white px-3 py-2.5 text-sm leading-5 text-apple-text outline-none ring-2 ring-apple-green/10 placeholder:text-apple-muted disabled:opacity-60"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={savingNote || !noteDraft.trim()}
                      onClick={() => void saveNote(item.id)}
                      className="rounded-lg bg-apple-green px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingNote ? "กำลังบันทึก..." : note ? "บันทึกการแก้ไข" : "บันทึก"}
                    </button>
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={closeNoteEditor}
                      className="rounded-lg px-2 py-2 text-sm font-medium text-apple-muted hover:text-apple-text disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatNoteTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function FilterButton({
  active,
  icon,
  label,
  count,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-white text-apple-blue shadow-sm" : "text-apple-muted hover:text-apple-text"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] ${active ? "bg-apple-blue/10" : "bg-white/70"}`}>{count}</span>
    </button>
  );
}
