"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TaskRichTextEditor } from "@/components/task-rich-text-editor";
import { TaskImagePicker, type DraftTaskImage } from "@/components/task-image-picker";
import { discardTaskImages, uploadTaskImage } from "@/actions/task-image-actions";
import { initialTaskDocument, normalizeTaskRichText, taskRichTextPlain } from "@/lib/task-rich-text";
import { taskImageUrl } from "@/lib/task-media";
import { createTask, updateTask } from "@/actions/task-actions";
import type { Category, Profile, ShareInput, TaskDetail } from "@/types/app";

const permissionLabels = {
  VIEWER: "ดูได้",
  CHECKER: "ติ๊ก Checklist",
  EDITOR: "แก้ไขได้"
};

type EditableChecklistItem = {
  key: string;
  id?: string;
  item_name: string;
  weight: number;
  is_checked: boolean;
};

function newChecklistItem(key = crypto.randomUUID()): EditableChecklistItem {
  return { key, item_name: "", weight: 1, is_checked: false };
}

function RequiredMark() {
  return (
    <span className="ml-1 text-apple-red" aria-hidden="true">
      *
    </span>
  );
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function SortableChecklistRow({
  item,
  index,
  showChecked,
  canCheck,
  onChange,
  onDelete
}: {
  item: EditableChecklistItem;
  index: number;
  showChecked: boolean;
  canCheck: boolean;
  onChange: (next: EditableChecklistItem) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid items-center gap-2 rounded-lg bg-apple-bg p-2 ${
        showChecked
          ? "grid-cols-[32px_32px_minmax(0,1fr)_76px_40px] sm:grid-cols-[32px_40px_minmax(0,1fr)_96px_40px]"
          : "grid-cols-[32px_minmax(0,1fr)_76px_40px] sm:grid-cols-[32px_minmax(0,1fr)_96px_40px]"
      } ${isDragging ? "z-10 shadow-panel" : ""}`}
    >
      <button
        type="button"
        className="flex h-9 w-8 touch-none items-center justify-center rounded-md text-apple-muted hover:bg-white hover:text-apple-text"
        title="ลากเพื่อจัดลำดับ"
        aria-label={`ลาก Checklist ลำดับที่ ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {showChecked ? (
        <label className="flex h-9 w-8 items-center justify-center" title={canCheck ? "สถานะ Checklist" : "ไม่มีสิทธิ์เปลี่ยนสถานะ"}>
          <input
            type="checkbox"
            checked={item.is_checked}
            disabled={!canCheck}
            onChange={(event) => onChange({ ...item, is_checked: event.target.checked })}
            className="h-5 w-5 accent-apple-green disabled:opacity-50"
            aria-label={`สถานะ ${item.item_name || `Checklist ${index + 1}`}`}
          />
        </label>
      ) : null}
      <input
        required
        value={item.item_name}
        onChange={(event) => onChange({ ...item, item_name: event.target.value })}
        className="min-w-0 rounded-md border border-transparent bg-white px-3 py-2 text-sm focus:border-apple-blue"
        placeholder="รายการ *"
        aria-label={`ชื่อ Checklist ลำดับที่ ${index + 1}`}
      />
      <input
        required
        min={0}
        step="0.01"
        type="number"
        value={item.weight}
        onChange={(event) => onChange({ ...item, weight: Number(event.target.value) })}
        className="min-w-0 rounded-md border border-transparent bg-white px-2 py-2 text-sm focus:border-apple-blue"
        aria-label={`น้ำหนัก Checklist ลำดับที่ ${index + 1}`}
        title="น้ำหนัก"
      />
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-apple-red"
        onClick={onDelete}
        title="ลบรายการ"
        aria-label={`ลบ Checklist ลำดับที่ ${index + 1}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function TaskForm({
  categories,
  users,
  currentUserId,
  initialTask,
  canCheckChecklist = true,
  onClose,
  onSaved,
  onDirtyChange,
  onBusyChange
}: {
  categories: Category[];
  users: Profile[];
  currentUserId: string;
  initialTask?: TaskDetail;
  canCheckChecklist?: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(() => initialTaskDocument(initialTask?.description_richtext, initialTask?.description ?? null));
  const [images, setImages] = useState<DraftTaskImage[]>(() => (initialTask?.images ?? []).map(image => ({ id: image.id, name: image.file_name, preview: taskImageUrl(image.id), thumbnail: taskImageUrl(image.id, true), uploaded: true })));
  const [dirty, setDirty] = useState(false);
  const [readingImages, setReadingImages] = useState(false);
  const stagedIds = useRef(new Set<string>());
  const objectUrls = useRef(new Set<string>());
  function markDirty() { setDirty(true); requestIdRef.current = null; }
  function changeImages(next: DraftTaskImage[]) {
    next.forEach(image => { if (image.preview.startsWith("blob:")) objectUrls.current.add(image.preview); });
    setImages(next); markDirty();
  }
  function requestClose() {
    if (submittingRef.current || readingImages) return;
    if (!dirty || window.confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการยกเลิกหรือไม่?")) onClose();
  }
  useEffect(() => {
    const urls = objectUrls.current, uploads = stagedIds.current;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); if (uploads.size) void discardTaskImages([...uploads]); };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const [items, setItems] = useState<EditableChecklistItem[]>(() => {
    const initialItems = initialTask?.checklist_items
      .filter((item) => !item.is_deleted)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        key: item.id,
        id: item.id,
        item_name: item.item_name,
        weight: Number(item.weight),
        is_checked: item.is_checked
      }));
    return initialItems?.length ? initialItems : [newChecklistItem("new-0")];
  });
  const [shares, setShares] = useState<ShareInput[]>(
    initialTask?.shares.map((share) => ({ user_id: share.user_id, permission: share.permission })) ?? []
  );
  const [nextUserId, setNextUserId] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  useEffect(() => { onBusyChange?.(isSubmitting || readingImages); }, [isSubmitting, readingImages, onBusyChange]);
  const requestIdRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const isEdit = Boolean(initialTask);
  const canManageShares = !initialTask || initialTask.owner_id === currentUserId;

  const availableUsers = useMemo(
    () => users.filter((user) => user.id !== currentUserId && !shares.some((share) => share.user_id === user.id)),
    [currentUserId, shares, users]
  );

  function addShare() {
    markDirty();
    if (!nextUserId || shares.some((share) => share.user_id === nextUserId)) return;
    setShares([...shares, { user_id: nextUserId, permission: "VIEWER" }]);
    setNextUserId("");
  }

  function addItem() {
    markDirty();
    setItems((current) => [...current, newChecklistItem()]);
    setChecklistError("");
  }

  function updateItem(key: string, next: EditableChecklistItem) {
    markDirty();
    setItems((current) => current.map((item) => (item.key === key ? next : item)));
    setChecklistError("");
  }

  function removeItem(key: string) {
    markDirty();
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function handleDragEnd(event: DragEndEvent) {
    markDirty();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.key === active.id);
      const newIndex = current.findIndex((item) => item.key === over.id);
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
    });
  }

  async function submit(formData: FormData) {
    if (submittingRef.current) return;
    if (items.length === 0) {
      setChecklistError("ต้องมี Checklist อย่างน้อย 1 รายการ");
      toast.error("ต้องมี Checklist อย่างน้อย 1 รายการ");
      return;
    }
    if (items.some((item) => !item.item_name.trim())) {
      setChecklistError("กรุณาระบุชื่อ Checklist ให้ครบ");
      toast.error("กรุณาระบุชื่อ Checklist ให้ครบ");
      return;
    }

    let document;
    try { document = normalizeTaskRichText(description); }
    catch (error) { toast.error(error instanceof Error ? error.message : "รายละเอียดไม่ถูกต้อง"); return; }
    if (readingImages) return;
    setChecklistError("");
    submittingRef.current = true;
    setIsSubmitting(true);
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    try {
      for (const image of images) {
        if (!image.uploaded && !await uploadOne(image)) return;
      }
      const checklistItems = items.map((item, index) => ({
        ...(item.id ? { id: item.id } : {}), item_name: item.item_name.trim(), weight: item.weight, is_checked: item.is_checked, sort_order: index + 1
      }));
      const payload = {
        task_name: String(formData.get("task_name")),
        description: taskRichTextPlain(document).trim(),
        description_richtext: document,
        gallery_image_ids: images.map(image => image.id),
        expected_updated_at: initialTask?.updated_at ?? null,
        due_at: formData.get("due_at") ? new Date(String(formData.get("due_at"))).toISOString() : null,
        category_id: String(formData.get("category_id")),
        checklist_items: checklistItems,
        ...(canManageShares ? { shares } : {})
      };
      const result = initialTask ? await updateTask(initialTask.id, payload, requestId) : await createTask(payload, requestId);
      if (result.ok) {
        requestIdRef.current = null;
        setDirty(false); onDirtyChange?.(false);
        toast.success(result.message);
        if (onSaved) onSaved(); else onClose();
        router.refresh();
      } else toast.error(result.message);
    } catch { toast.error("เชื่อมต่อไม่สำเร็จ ข้อมูลในฟอร์มยังอยู่ กรุณาลองบันทึกอีกครั้ง"); }
    finally { submittingRef.current = false; setIsSubmitting(false); }
  }

  async function uploadOne(image: DraftTaskImage) {
    if (!image.file) return image.uploaded;
    stagedIds.current.add(image.id);
    setImages(rows => rows.map(row => row.id === image.id ? { ...row, status: "uploading", error: undefined } : row));
    try {
      const data = new FormData(); data.set("image_id", image.id); data.set("image", image.file);
      if (initialTask) data.set("task_id", initialTask.id);
      const result = await uploadTaskImage(data);
      if (!result.ok) throw new Error(result.message);
      setImages(rows => rows.map(row => row.id === image.id ? { ...row, uploaded: true, status: undefined, error: undefined } : row));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ";
      setImages(rows => rows.map(row => row.id === image.id ? { ...row, status: "error", error: message } : row));
      toast.error(`${image.name}: ${message}`); return false;
    }
  }

  async function retryImage(id: string) {
    if (submittingRef.current) return;
    const image = images.find(row => row.id === id); if (!image) return;
    submittingRef.current = true; setIsSubmitting(true);
    try { await uploadOne(image); }
    finally { submittingRef.current = false; setIsSubmitting(false); }
  }

  return (
    <form
      onSubmit={event => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}
      className="relative"
      aria-busy={isSubmitting}
      onInput={() => {
        if (!submittingRef.current) markDirty();
      }}
    >
      <fieldset disabled={isSubmitting || readingImages} className="min-w-0 space-y-5">
      {isSubmitting ? <div className="absolute inset-0 z-20 cursor-wait" aria-hidden="true" /> : null}
      <label className="block">
        <span className="text-sm font-medium text-apple-text">
          ชื่อ Task
          <RequiredMark />
        </span>
        <input
          required
          name="task_name"
          defaultValue={initialTask?.task_name}
          className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm focus:border-apple-blue"
        />
      </label>
      <label className="block">
        <span className="flex items-center gap-2 text-sm font-medium text-apple-text">
          <CalendarClock className="h-4 w-4 text-apple-blue" /> วันและเวลาครบกำหนด
        </span>
        <input
          name="due_at"
          type="datetime-local"
          defaultValue={toDateTimeLocal(initialTask?.due_at)}
          className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm focus:border-apple-blue"
        />
        <span className="mt-1 block text-xs text-apple-muted">ไม่บังคับ · ใช้เขตเวลา Asia/Bangkok</span>
      </label>
      <div>
        <span className="mb-2 block text-sm font-medium text-apple-text">รายละเอียด Task</span>
        <TaskRichTextEditor initialValue={description} disabled={isSubmitting || readingImages} onChange={doc => { setDescription(doc); markDirty(); }} />
      </div>
      <TaskImagePicker images={images} disabled={isSubmitting} onChange={changeImages} onRetry={id => void retryImage(id)} onReadingChange={setReadingImages} />
      <label className="block">
        <span className="text-sm font-medium text-apple-text">
          หมวดหมู่
          <RequiredMark />
        </span>
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

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-apple-text">
            Checklist
            <RequiredMark />
          </span>
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg bg-apple-bg px-3 py-2 text-xs font-semibold"
            onClick={addItem}
          >
            <Plus className="h-4 w-4" /> เพิ่ม
          </button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item, index) => (
                <SortableChecklistRow
                  key={item.key}
                  item={item}
                  index={index}
                  showChecked={isEdit}
                  canCheck={canCheckChecklist}
                  onChange={(next) => updateItem(item.key, next)}
                  onDelete={() => removeItem(item.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {items.length === 0 ? (
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-apple-line px-4 py-4 text-sm font-medium text-apple-blue"
          >
            <Plus className="mr-1 inline h-4 w-4" /> เพิ่ม Checklist รายการแรก
          </button>
        ) : null}
        {checklistError ? (
          <p className="mt-2 text-sm text-apple-red" role="alert">
            {checklistError}
          </p>
        ) : null}
      </div>

      {canManageShares ? (
        <div>
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
                    onClick={() => { setShares(shares.filter((row) => row.user_id !== share.user_id)); markDirty(); }}
                    title="นำสมาชิกออก"
                    aria-label="นำสมาชิกออก"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="rounded-lg bg-apple-bg px-5 py-2.5 text-sm font-semibold" onClick={requestClose}>
          ยกเลิก
        </button>
        <button disabled={isSubmitting || readingImages} className="rounded-lg bg-apple-blue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {isSubmitting ? "กำลังบันทึก..." : isEdit ? "บันทึกการแก้ไข" : "บันทึก Task"}
        </button>
      </div>
      </fieldset>
    </form>
  );
}
