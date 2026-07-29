"use client";

import { useMemo, useState, useTransition } from "react";
import { ArchiveRestore, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Category, Profile, TaskDetail, TaskSummary } from "@/types/app";
import { archiveTask, deleteTask, getTaskDetail, restoreTask } from "@/actions/task-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { TaskCard } from "@/components/task-card";
import { TaskCloneDialog } from "@/components/task-clone-dialog";
import { TaskForm } from "@/components/task-form";
import { TaskDetailPanel } from "@/components/task-detail";

type InitialData = {
  currentUser: Profile;
  tasks: TaskSummary[];
  categories: Category[];
  users: Profile[];
};

const filters = [
  { key: "all", label: "ทั้งหมด" },
  { key: "mine", label: "งานของฉัน" },
  { key: "shared", label: "แชร์กับฉัน" },
  { key: "TODO", label: "ที่ต้องทำ" },
  { key: "IN_PROGRESS", label: "กำลังดำเนินการ" },
  { key: "COMPLETED", label: "เสร็จสิ้น" },
  { key: "archive", label: "Archive" }
];

export function TaskDashboard({ initial }: { initial: InitialData }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");
  const [categoryId, setCategoryId] = useState("ALL");
  const [sort, setSort] = useState<"updated_desc" | "created_desc">("updated_desc");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [cloneTarget, setCloneTarget] = useState<TaskSummary | null>(null);
  const [confirm, setConfirm] = useState<{ type: "archive" | "delete"; task: TaskSummary } | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleTasks = useMemo(() => {
    const cleanQuery = query.trim().toLocaleLowerCase("th");
    return initial.tasks
      .filter((task) => {
        if (activeFilter === "mine" && task.owner_id !== initial.currentUser.id) return false;
        if (activeFilter === "shared" && task.owner_id === initial.currentUser.id) return false;
        if (activeFilter === "TODO" || activeFilter === "IN_PROGRESS" || activeFilter === "COMPLETED") {
          if (task.status !== activeFilter) return false;
        }
        if (activeFilter === "archive") {
          if (!task.is_archived) return false;
        } else if (task.is_archived) {
          return false;
        }
        if (categoryId !== "ALL" && task.category_id !== categoryId) return false;
        if (cleanQuery && !`${task.task_name} ${task.description ?? ""}`.toLocaleLowerCase("th").includes(cleanQuery)) return false;
        return true;
      })
      .sort((a, b) => {
        const key = sort === "created_desc" ? "created_at" : "updated_at";
        return new Date(b[key]).getTime() - new Date(a[key]).getTime();
      });
  }, [activeFilter, categoryId, initial.currentUser.id, initial.tasks, query, sort]);

  function runConfirm() {
    if (!confirm || isPending) return;
    startTransition(async () => {
      const result = confirm.type === "archive" ? await archiveTask(confirm.task.id) : await deleteTask(confirm.task.id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setConfirm(null);
    });
  }

  function openDetail(taskId: string) {
    if (isPending) return;
    startTransition(async () => {
      const result = await getTaskDetail(taskId);
      if (result.ok) setDetail(result.data);
      else toast.error(result.message);
    });
  }

  function restore(taskId: string) {
    if (isPending) return;
    startTransition(async () => {
      const result = await restoreTask(taskId);
      if (result.ok) {
        toast.success("Restore Task แล้ว");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-7">
      <section className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-apple-muted">Task Management</p>
          <h1 className="text-3xl font-semibold text-apple-text">งานของทีม Plabin</h1>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white shadow-soft"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" /> เพิ่ม Task
        </button>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-apple-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-apple-line bg-white py-3 pl-11 pr-4 text-sm"
            placeholder="ค้นหาชื่อหรือรายละเอียด Task"
          />
        </label>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-lg border border-apple-line bg-white px-4 py-3 text-sm">
          <option value="ALL">ทุกหมวดหมู่</option>
          {initial.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.category_name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-lg border border-apple-line bg-white px-4 py-3 text-sm">
          <option value="updated_desc">แก้ไขล่าสุด</option>
          <option value="created_desc">วันที่สร้าง</option>
        </select>
      </section>

      <div className="apple-scrollbar mb-6 flex gap-2 overflow-x-auto pb-2">
        {filters.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveFilter(item.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeFilter === item.key ? "bg-apple-text text-white" : "bg-white text-apple-muted shadow-soft hover:text-apple-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleTasks.map((task) => (
            <div key={task.id} className="relative">
              <TaskCard
                task={task}
                user={initial.currentUser}
                onOpen={() => openDetail(task.id)}
                onClone={() => setCloneTarget(task)}
                onArchive={() => setConfirm({ type: "archive", task })}
                onDelete={() => setConfirm({ type: "delete", task })}
              />
              {activeFilter === "archive" && task.owner_id === initial.currentUser.id ? (
                <button
                  onClick={() => restore(task.id)}
                  className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-apple-green shadow-soft"
                  title="Restore Task"
                  aria-label="Restore Task"
                >
                  <ArchiveRestore className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-panel sm:rounded-lg">
            <h2 className="text-2xl font-semibold text-apple-text">สร้าง Task ใหม่</h2>
            <div className="mt-5">
              <TaskForm
                categories={initial.categories}
                users={initial.users}
                currentUserId={initial.currentUser.id}
                onClose={() => setShowCreate(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <TaskDetailPanel
          task={detail}
          currentUser={initial.currentUser}
          categories={initial.categories}
          users={initial.users}
          onClose={() => setDetail(null)}
        />
      ) : null}
      <TaskCloneDialog task={cloneTarget} onClose={() => setCloneTarget(null)} />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.type === "archive" ? "Archive Task นี้?" : "ลบ Task นี้?"}
        description={confirm?.type === "archive" ? "Task จะย้ายไปอยู่ใน Archive และ Restore กลับมาได้" : "ระบบจะลบแบบ Soft Delete และซ่อนจากรายการปกติ"}
        confirmText={isPending ? "กำลังทำรายการ..." : "ยืนยัน"}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </main>
  );
}
