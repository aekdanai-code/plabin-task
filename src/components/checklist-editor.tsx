"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { toggleChecklistItem } from "@/actions/checklist-actions";
import type { ChecklistItem } from "@/types/app";

export function ChecklistEditor({ items, canCheck }: { items: ChecklistItem[]; canCheck: boolean }) {
  const [rows, setRows] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(item: ChecklistItem) {
    if (!canCheck || pendingId) return;
    const nextChecked = !item.is_checked;
    setPendingId(item.id);
    setRows((current) => current.map((row) => (row.id === item.id ? { ...row, is_checked: nextChecked } : row)));
    startTransition(async () => {
      const result = await toggleChecklistItem(item.id, nextChecked);
      if (!result.ok) {
        setRows((current) => current.map((row) => (row.id === item.id ? { ...row, is_checked: item.is_checked } : row)));
        toast.error(result.message);
      }
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-2">
      {rows.map((item) => (
        <button
          type="button"
          key={item.id}
          disabled={!canCheck || pendingId === item.id}
          onClick={() => toggle(item)}
          className="flex w-full items-center gap-3 rounded-lg bg-apple-bg p-3 text-left disabled:cursor-default"
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
