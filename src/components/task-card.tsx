"use client";

import { Archive, CalendarClock, CheckCircle2, Copy, MoreHorizontal, Trash2 } from "lucide-react";
import type { Profile, TaskSummary } from "@/types/app";
import { formatThaiDate, initials, relativeThaiTime } from "@/lib/format";
import { taskAccess, canManageTask } from "@/lib/permissions";

const statusLabel = {
  TODO: "ที่ต้องทำ",
  IN_PROGRESS: "กำลังดำเนินการ",
  COMPLETED: "เสร็จสิ้น"
};

const statusStyle = {
  TODO: "bg-apple-blue/12 text-apple-blue",
  IN_PROGRESS: "bg-apple-orange/15 text-apple-orange",
  COMPLETED: "bg-apple-green/15 text-apple-green"
};

export function TaskCard({
  task,
  user,
  onOpen,
  onClone,
  onArchive,
  onDelete
}: {
  task: TaskSummary;
  user: Profile;
  onOpen: () => void;
  onClone: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const access = taskAccess(task, user);
  const progress = Math.round(Number(task.progress));

  return (
    <article className="group relative overflow-hidden rounded-lg bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-panel">
      <div style={{ backgroundColor: task.category?.color ?? "#007AFF" }} className="h-1.5 w-full" />
      <button className="block w-full p-5 text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="inline-flex rounded-md px-2 py-1 text-xs font-semibold"
              style={{
                color: task.category?.color ?? "#007AFF",
                backgroundColor: `${task.category?.color ?? "#007AFF"}18`
              }}
            >
              {task.category?.category_name ?? "ไม่ระบุหมวดหมู่"}
            </p>
            <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug text-apple-text">{task.task_name}</h3>
          </div>
          <span className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold ${statusStyle[task.status]}`}>{statusLabel[task.status]}</span>
        </div>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-apple-muted">{task.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
        {task.due_at ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-apple-orange">
            <CalendarClock className="h-3.5 w-3.5" /> ครบกำหนด {formatThaiDate(task.due_at)}
          </p>
        ) : null}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-apple-muted">
            <span>{task.checklist_done ?? 0}/{task.checklist_total ?? 0} รายการ</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-apple-bg">
            <div className="h-full rounded-full bg-apple-blue transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-5">
          <div className="flex -space-x-2">
            {(task.collaborators ?? []).slice(0, 3).map((person) => (
              <span key={person.id} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-apple-bg text-[11px] font-semibold text-apple-text">
                {initials(person.display_name || person.email)}
              </span>
            ))}
            {(task.collaborators?.length ?? 0) > 3 ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-apple-text text-[11px] font-semibold text-white">
                +{(task.collaborators?.length ?? 0) - 3}
              </span>
            ) : null}
          </div>
          <time className="mt-3 block text-left text-xs text-apple-muted" title={formatThaiDate(task.updated_at)}>
            {relativeThaiTime(task.updated_at)}
          </time>
        </div>
      </button>
      <div className="absolute bottom-4 right-4 flex gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
        <button className="rounded-full bg-white/95 p-2 text-apple-muted shadow-soft hover:text-apple-blue" title="Clone Task" aria-label="Clone Task" onClick={onClone}>
          <Copy className="h-4 w-4" />
        </button>
        {canManageTask(access) && task.status === "COMPLETED" ? (
          <button className="rounded-full bg-white/95 p-2 text-apple-muted shadow-soft hover:text-apple-orange" title="Archive" aria-label="Archive" onClick={onArchive}>
            <Archive className="h-4 w-4" />
          </button>
        ) : null}
        {canManageTask(access) ? (
          <button className="rounded-full bg-white/95 p-2 text-apple-muted shadow-soft hover:text-apple-red" title="ลบ Task" aria-label="ลบ Task" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <span className="rounded-full bg-white/95 p-2 text-apple-muted shadow-soft" title={`สิทธิ์ ${access}`}>
            {access === "CHECKER" ? <CheckCircle2 className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}
          </span>
        )}
      </div>
    </article>
  );
}
