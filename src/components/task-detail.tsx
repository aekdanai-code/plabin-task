"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { BellRing, CalendarClock, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { notifyTaskTeam } from "@/actions/notification-actions";
import { ChecklistEditor } from "@/components/checklist-editor";
import { RichTextWithLinks } from "@/components/rich-text-with-links";
import { TaskForm } from "@/components/task-form";
import { formatThaiDate } from "@/lib/format";
import { canCheckTask, canEditTask, taskAccess } from "@/lib/permissions";
import type { Category, ChecklistItem, Profile, TaskDetail, TaskStatus } from "@/types/app";

const statusStyle = {
  TODO: "bg-apple-blue/12 text-apple-blue",
  IN_PROGRESS: "bg-apple-orange/15 text-apple-orange",
  COMPLETED: "bg-apple-green/15 text-apple-green"
};

const statusLabel = {
  TODO: "ที่ต้องทำ",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "เสร็จสิ้น"
};

export function TaskDetailPanel({
  task,
  currentUser,
  categories,
  users,
  onClose
}: {
  task: TaskDetail;
  currentUser: Profile;
  categories: Category[];
  users: Profile[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(Number(task.progress));
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [isPending, startTransition] = useTransition();
  const access = taskAccess(task, currentUser);
  const visibleChecklist = useMemo(
    () => task.checklist_items.filter((item) => !item.is_deleted),
    [task.checklist_items]
  );

  useEffect(() => {
    setProgress(Number(task.progress));
    setStatus(task.status);
  }, [task]);

  function updateChecklistProgress(items: ChecklistItem[]) {
    const totalWeight = items.reduce((total, item) => total + Number(item.weight), 0);
    const completedWeight = items.reduce((total, item) => total + (item.is_checked ? Number(item.weight) : 0), 0);
    const nextProgress = totalWeight > 0 ? Math.min(100, (completedWeight / totalWeight) * 100) : 0;
    setProgress(nextProgress);
    setStatus(nextProgress === 0 ? "TODO" : nextProgress >= 100 ? "COMPLETED" : "IN_PROGRESS");
  }

  function notifyTeam() {
    if (isPending) return;
    startTransition(async () => {
      const result = await notifyTaskTeam(task.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-panel sm:rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span
              className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold"
              style={{ color: task.category?.color, backgroundColor: `${task.category?.color ?? "#007AFF"}18` }}
            >
              {task.category?.category_name}
            </span>
            <h2 className="mt-2 break-words text-2xl font-semibold text-apple-text">{task.task_name}</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-apple-bg" title="ปิด" aria-label="ปิด">
            <X className="h-5 w-5" />
          </button>
        </div>

        {editing ? (
          <div className="mt-5 border-t border-apple-line pt-5">
            <TaskForm
              categories={categories}
              users={users}
              currentUserId={currentUser.id}
              initialTask={task}
              canCheckChecklist={canCheckTask(access)}
              onClose={() => setEditing(false)}
              onSaved={onClose}
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-3 py-1 text-xs font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span>
              <span className="text-xs text-apple-muted">สิทธิ์ {access}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-apple-muted">
              {task.description ? <RichTextWithLinks text={task.description} /> : "ไม่มีรายละเอียดเพิ่มเติม"}
            </p>
            {task.due_at ? (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-apple-orange">
                <CalendarClock className="h-4 w-4" /> ครบกำหนด {formatThaiDate(task.due_at)}
              </p>
            ) : null}
            <div className="mt-5 rounded-lg bg-apple-bg p-4">
              <div className="mb-2 flex justify-between text-sm font-medium text-apple-muted">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-white">
                <div className="h-full rounded bg-apple-blue transition-all duration-300" style={{ width: `${Math.round(progress)}%` }} />
              </div>
            </div>
            <div className="mt-6">
              <h3 className="mb-3 font-semibold text-apple-text">Checklist</h3>
              <ChecklistEditor
                items={visibleChecklist}
                canCheck={canCheckTask(access)}
                taskId={task.id}
                userId={currentUser.id}
                onRowsChange={updateChecklistProgress}
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-apple-line pt-4">
              <p className="self-center text-xs text-apple-muted">อัปเดตล่าสุด {formatThaiDate(task.updated_at)}</p>
              <div className="flex gap-2">
                {canEditTask(access) && task.shares.length > 0 ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={notifyTeam}
                    className="flex items-center gap-2 rounded-lg bg-apple-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <BellRing className="h-4 w-4" /> {isPending ? "กำลังแจ้ง..." : "แจ้งทีม"}
                  </button>
                ) : null}
                {canEditTask(access) ? (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 rounded-lg bg-apple-blue px-4 py-2 text-sm font-semibold text-white"
                  >
                    <Pencil className="h-4 w-4" /> แก้ไข Task
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
