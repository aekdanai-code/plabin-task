"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { toggleChecklistItem } from "@/actions/checklist-actions";
import type { ChecklistItem } from "@/types/app";

export function ChecklistEditor({
  items,
  canCheck,
  onRowsChange
}: {
  items: ChecklistItem[];
  canCheck: boolean;
  onRowsChange?: (items: ChecklistItem[]) => void;
}) {
  const [rows, setRows] = useState(items);
  const rowsRef = useRef(items);
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  useEffect(() => {
    rowsRef.current = items;
    setRows(items);
  }, [items]);

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
    <div className="space-y-2">
      {rows.map((item) => (
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
  );
}
