"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTask, updateTask } from "@/actions/task-actions";
import type { Category, Profile, ShareInput, TaskDetail } from "@/types/app";

const permissionLabels = {
  VIEWER: "ดูได้",
  CHECKER: "ติ๊ก Checklist",
  EDITOR: "แก้ไขได้"
};

export function TaskForm({
  categories,
  users,
  currentUserId,
  initialTask,
  onClose
}: {
  categories: Category[];
  users: Profile[];
  currentUserId: string;
  initialTask?: TaskDetail;
  onClose: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(
    initialTask?.checklist_items.map((item) => ({ item_name: item.item_name, weight: Number(item.weight) })) ?? [
      { item_name: "", weight: 1 }
    ]
  );
  const [shares, setShares] = useState<ShareInput[]>(
    initialTask?.shares.map((share) => ({ user_id: share.user_id, permission: share.permission })) ?? []
  );
  const [nextUserId, setNextUserId] = useState("");
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(initialTask);
  const canManageShares = !initialTask || initialTask.owner_id === currentUserId;

  const availableUsers = useMemo(
    () => users.filter((user) => user.id !== currentUserId && !shares.some((share) => share.user_id === user.id)),
    [currentUserId, shares, users]
  );

  function addShare() {
    if (!nextUserId || shares.some((share) => share.user_id === nextUserId)) return;
    setShares([...shares, { user_id: nextUserId, permission: "VIEWER" }]);
    setNextUserId("");
  }

  function submit(formData: FormData) {
    if (isPending) return;
    startTransition(async () => {
      const payload = {
        task_name: String(formData.get("task_name")),
        description: String(formData.get("description") || ""),
        category_id: String(formData.get("category_id")),
        checklist_items: items,
        ...(canManageShares ? { shares } : {})
      };
      const result = initialTask ? await updateTask(initialTask.id, payload) : await createTask(payload);
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-apple-text">ชื่อ Task</span>
        <input
          required
          name="task_name"
          defaultValue={initialTask?.task_name}
          className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm focus:border-apple-blue"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-apple-text">รายละเอียด</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={initialTask?.description ?? ""}
          className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm focus:border-apple-blue"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-apple-text">หมวดหมู่</span>
        <select
          required
          name="category_id"
          defaultValue={initialTask?.category_id ?? ""}
          className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm focus:border-apple-blue"
        >
          <option value="">เลือกหมวดหมู่</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.category_name}
            </option>
          ))}
        </select>
      </label>

      {!isEdit ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-apple-text">Checklist</span>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg bg-apple-bg px-3 py-2 text-xs font-semibold"
              onClick={() => setItems([...items, { item_name: "", weight: 1 }])}
            >
              <Plus className="h-4 w-4" /> เพิ่ม
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_88px_40px] gap-2 rounded-lg bg-apple-bg p-2">
                <input
                  required
                  value={item.item_name}
                  onChange={(event) =>
                    setItems(items.map((row, rowIndex) => (rowIndex === index ? { ...row, item_name: event.target.value } : row)))
                  }
                  className="min-w-0 rounded-md border border-transparent bg-white px-3 py-2 text-sm"
                  placeholder="รายการ"
                />
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={item.weight}
                  onChange={(event) =>
                    setItems(items.map((row, rowIndex) => (rowIndex === index ? { ...row, weight: Number(event.target.value) } : row)))
                  }
                  className="min-w-0 rounded-md border border-transparent bg-white px-3 py-2 text-sm"
                  aria-label="น้ำหนัก"
                />
                <button
                  type="button"
                  className="rounded-md bg-white text-apple-red disabled:opacity-40"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, rowIndex) => rowIndex !== index))}
                  title="ลบรายการ"
                  aria-label="ลบรายการ"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {canManageShares ? <div>
        <span className="text-sm font-medium text-apple-text">แชร์ให้สมาชิก</span>
        <div className="mt-2 flex gap-2">
          <select
            value={nextUserId}
            onChange={(event) => setNextUserId(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-apple-line px-4 py-3 text-sm"
            aria-label="เลือกสมาชิก"
          >
            <option value="">เลือกชื่อสมาชิก</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name || user.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!nextUserId}
            onClick={addShare}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-apple-blue text-white disabled:opacity-40"
            title="เพิ่มสมาชิก"
            aria-label="เพิ่มสมาชิก"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {shares.map((share) => {
            const user = users.find((row) => row.id === share.user_id);
            return (
              <div key={share.user_id} className="grid grid-cols-[1fr_145px_40px] items-center gap-2 rounded-lg bg-apple-bg p-2">
                <span className="truncate px-2 text-sm font-medium">{user?.display_name || user?.email || "สมาชิก"}</span>
                <select
                  value={share.permission}
                  onChange={(event) =>
                    setShares(
                      shares.map((row) =>
                        row.user_id === share.user_id
                          ? { ...row, permission: event.target.value as ShareInput["permission"] }
                          : row
                      )
                    )
                  }
                  className="rounded-md border-0 bg-white px-2 py-2 text-xs"
                >
                  {Object.entries(permissionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-apple-red"
                  onClick={() => setShares(shares.filter((row) => row.user_id !== share.user_id))}
                  title="นำสมาชิกออก"
                  aria-label="นำสมาชิกออก"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div> : null}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-lg bg-apple-bg px-5 py-2.5 text-sm font-semibold" onClick={onClose}>
          ยกเลิก
        </button>
        <button disabled={isPending} className="rounded-lg bg-apple-blue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {isPending ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "บันทึก Task"}
        </button>
      </div>
    </form>
  );
}
