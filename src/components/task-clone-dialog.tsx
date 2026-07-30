"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TaskSummary } from "@/types/app";
import { cloneTask } from "@/actions/task-actions";

export function TaskCloneDialog({ task, onClose }: { task: TaskSummary | null; onClose: () => void }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);
  if (!task) return null;
  const currentTask = task;

  async function submit(formData: FormData) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    const result = await cloneTask(currentTask.id, String(formData.get("task_name")), requestId);
    if (result.ok) {
      requestIdRef.current = null;
      toast.success(result.message);
      onClose();
      router.refresh();
    } else {
      pendingRef.current = false;
      setIsPending(false);
      toast.error(result.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form
        action={submit}
        className="relative w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-panel sm:rounded-lg"
        aria-busy={isPending}
        onInput={() => {
          if (!pendingRef.current) requestIdRef.current = null;
        }}
      >
        {isPending ? <div className="absolute inset-0 z-20 cursor-wait" aria-hidden="true" /> : null}
        <p className="text-sm font-medium text-apple-muted">Clone Task</p>
        <h2 className="mt-1 text-2xl font-semibold text-apple-text">สร้างสำเนา Task</h2>
        <label className="mt-5 block">
          <span className="text-sm font-medium text-apple-text">ชื่อ Task ใหม่</span>
          <input
            required
            name="task_name"
            defaultValue={`${task.task_name} (สำเนา)`}
            className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm focus:border-apple-blue"
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-apple-muted">Checklist จะเริ่มเป็นยังไม่เสร็จทั้งหมด, Progress 0% และไม่คัดลอกรายชื่อผู้ที่แชร์</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg bg-apple-bg px-5 py-2.5 text-sm font-semibold" onClick={onClose}>
            ยกเลิก
          </button>
          <button disabled={isPending} className="rounded-lg bg-apple-blue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {isPending ? "กำลัง Clone..." : "Clone"}
          </button>
        </div>
      </form>
    </div>
  );
}
