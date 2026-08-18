"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, CheckCircle2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { toggleChecklistItem } from "@/actions/checklist-actions";
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
  const rowsRef = useRef(items);
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const filterStorageKey = `plabin:checklist-view:v1:${userId}:${taskId}`;
  const pendingCount = useMemo(() => rows.filter((item) => !item.is_checked).length, [rows]);
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
      commitRows(rowsRef.current.map((row) => (row.id === item.id ? result.data : row)));
    }
    pendingRef.current.delete(item.id);
    setPendingIds(Array.from(pendingRef.current));
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-apple-muted">
          รอตรวจ {pendingCount} จาก {rows.length} รายการ
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
          {filteredRows.map((item) => (
            <button
              type="button"
              key={item.id}
              disabled={!canCheck || pendingIds.includes(item.id)}
              onClick={() => void toggle(item)}
              className="flex w-full items-center gap-3 rounded-lg bg-apple-bg p-3 text-left disabled:cursor-default disabled:opacity-70"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  item.is_checked ? "border-apple-green bg-apple-green text-white" : "border-apple-line bg-white"
                }`}
              >
                {item.is_checked ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span className={`min-w-0 flex-1 text-sm ${item.is_checked ? "text-apple-muted line-through" : "text-apple-text"}`}>
                {item.item_name}
              </span>
              <span className="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-medium text-apple-muted">W {item.weight}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
