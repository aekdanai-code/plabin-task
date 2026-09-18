"use server";

import { normalizeTaskRichText, taskRichTextPlain } from "@/lib/task-rich-text";
import { TASK_IMAGE_BUCKET, type TaskImage } from "@/lib/task-media";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fail, ok, toErrorResult } from "@/lib/result";
import { taskInputSchema, taskUpdateSchema, uuidSchema } from "@/lib/validators";
import type { ActionResult, TaskDetail, TaskFilters, TaskSummary } from "@/types/app";

type TaskRow = TaskSummary & {
  categories?: TaskSummary["category"];
  checklist_items?: Array<{ id: string; is_checked: boolean }>;
  task_shares?: Array<{
    permission: "VIEWER" | "CHECKER" | "EDITOR";
    profile: { id: string; email: string; display_name: string | null; avatar_url: string | null } | null;
  }>;
};

function mapTask(row: TaskRow, userId: string): TaskSummary {
  const collaborators = (row.task_shares ?? []).map((share) => share.profile).filter(Boolean) as NonNullable<TaskSummary["collaborators"]>;
  const checklist = row.checklist_items ?? [];
  const share = row.task_shares?.find((item) => item.profile?.id === userId);

  return {
    ...row,
    category: row.categories,
    checklist_total: checklist.length,
    checklist_done: checklist.filter((item) => item.is_checked).length,
    collaborators,
    access_level: row.owner_id === userId ? "OWNER" : share?.permission
  };
}

export async function getInitialData(filters: TaskFilters = {}) {
  const user = await requireUser();
  const supabase = await createClient();
  const [tasks, categories, users] = await Promise.all([
    getTasks(filters),
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("profiles").select("*").eq("is_active", true).order("display_name")
  ]);

  if (!tasks.ok) return tasks;
  if (categories.error) return fail("LOAD_CATEGORIES_FAILED", categories.error.message);
  if (users.error) return fail("LOAD_USERS_FAILED", users.error.message);

  return ok(
    {
      currentUser: user,
      tasks: tasks.data,
      categories: categories.data ?? [],
      users: users.data ?? []
    },
    "โหลดข้อมูลสำเร็จ"
  );
}

export async function getTasks(filters: TaskFilters = {}): Promise<ActionResult<TaskSummary[]>> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    let query = supabase
      .from("tasks")
      .select(
        "*, categories(*), checklist_items(id,is_checked), task_shares(permission, profile:profiles!task_shares_user_id_fkey(id,email,display_name,avatar_url))"
      )
      .eq("is_deleted", false);

    if (typeof filters.archived === "boolean") query = query.eq("is_archived", filters.archived);

    if (filters.scope === "mine") query = query.eq("owner_id", user.id);
    if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.search) {
      const search = filters.search.trim();
      query = query.or(`task_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    switch (filters.sort) {
      case "created_desc":
        query = query.order("created_at", { ascending: false });
        break;
      default:
        query = query.order("updated_at", { ascending: false });
    }

    const { data, error } = await query.limit(100);
    if (error) return fail("LOAD_TASKS_FAILED", error.message);

    const tasks = (data as unknown as TaskRow[]).map((row) => mapTask(row, user.id));
    const scoped = filters.scope === "shared" ? tasks.filter((task) => task.owner_id !== user.id) : tasks;
    return ok(scoped, "โหลด Task สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function getTaskDetail(taskId: string): Promise<ActionResult<TaskDetail>> {
  try {
    uuidSchema.parse(taskId);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "*, categories(*), checklist_items(*, checklist_notes(*, author:profiles!checklist_notes_author_id_fkey(id,email,display_name,avatar_url))), task_shares(*, profile:profiles!task_shares_user_id_fkey(id,email,display_name,avatar_url))"
      )
      .eq("id", taskId)
      .eq("is_deleted", false)
      .single();

    if (error || !data) return fail("TASK_NOT_FOUND", "ไม่พบ Task หรือคุณไม่มีสิทธิ์เข้าถึง");

    const mapped = mapTask(data as unknown as TaskRow, user.id) as TaskDetail;
    mapped.checklist_items = ((data as { checklist_items?: TaskDetail["checklist_items"] }).checklist_items ?? [])
      .map((item) => ({
        ...item,
        checklist_notes: [...(item.checklist_notes ?? [])]
          .filter((note) => note.is_active !== false)
          .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime())
          .slice(0, 1)
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    mapped.shares = ((data as { task_shares?: TaskDetail["shares"] }).task_shares ?? []).filter((share) => share.is_active);
    const images = await supabase.from("task_images").select("*").eq("task_id", taskId).eq("is_removed", false).order("sort_order");
    if (images.error) return fail("LOAD_TASK_IMAGES_FAILED", "โหลดรูปภาพแนบไม่สำเร็จ กรุณาลองใหม่");
    mapped.images = (images.data ?? []) as TaskImage[];
    return ok(mapped, "โหลดรายละเอียดสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function createTask(payload: unknown, requestId: string): Promise<ActionResult<TaskSummary>> {
  return saveTask(null, payload, requestId);
}

export async function updateTask(taskId: string, payload: unknown, requestId: string): Promise<ActionResult<TaskSummary>> {
  return saveTask(taskId, payload, requestId);
}

async function saveTask(taskId: string | null, payload: unknown, requestId: string): Promise<ActionResult<TaskSummary>> {
  try {
    if (taskId) uuidSchema.parse(taskId);
    uuidSchema.parse(requestId);
    const input = (taskId ? taskUpdateSchema : taskInputSchema).parse(payload);
    await requireUser();
    const rich = input.description_richtext ? normalizeTaskRichText(input.description_richtext) : null;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_task_content", {
      target_task_id: taskId,
      payload: { ...input, description: rich ? taskRichTextPlain(rich).trim() : input.description || "", description_richtext: rich },
      image_ids: input.gallery_image_ids,
      request_id: requestId,
      expected_updated_at: input.expected_updated_at ?? null
    });
    if (error || !data) {
      const message = error?.message.includes("TASK_CHANGED_RELOAD")
        ? "Task นี้มีการแก้ไขจากที่อื่น กรุณาคัดลอกข้อความที่แก้ไว้ แล้วปิดและเปิด Task ใหม่ก่อนบันทึก"
        : error?.message.includes("IMAGE_UPLOAD_INCOMPLETE")
          ? "มีรูปที่อัปโหลดไม่สมบูรณ์ กรุณาลองอัปโหลดใหม่"
          : error?.message ?? "บันทึก Task ไม่สำเร็จ";
      return fail("SAVE_TASK_FAILED", message);
    }
    // The DB transaction is already committed. File cleanup must never undo a save.
    let warning = "";
    try {
      const removed = await supabase.from("task_images").select("id,storage_path").eq("task_id", data.id).eq("is_removed", true);
      if (removed.data?.length) {
        const cleanup = await supabase.storage.from(TASK_IMAGE_BUCKET).remove(removed.data.map(image => image.storage_path));
        if (cleanup.error) warning = " (นำรูปออกแล้ว แต่ล้างไฟล์เก่าไม่สำเร็จ)";
      }
      if (taskId) {
        const notification = await supabase.rpc("emit_task_notification", { target_task_id: taskId, target_event_type: "TASK_EDITED", event_payload: { request_id: requestId } });
        if (notification.error) warning += " (สร้างการแจ้งเตือนไม่สำเร็จ)";
      }
    } catch { warning = " (บันทึกแล้ว แต่ขั้นตอนล้างไฟล์หรือแจ้งเตือนยังไม่สำเร็จ)"; }
    revalidatePath("/");
    return ok(data as TaskSummary, `${taskId ? "แก้ไข" : "สร้าง"} Task สำเร็จ${warning}`);
  } catch (error) { return toErrorResult(error, "ข้อมูล Task ไม่ถูกต้อง"); }
}

export async function cloneTask(taskId: string, taskName: string, requestId: string): Promise<ActionResult<TaskSummary>> {
  try {
    uuidSchema.parse(taskId);
    uuidSchema.parse(requestId);
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("clone_task", {
      source_task_id: taskId,
      next_task_name: taskName.trim(),
      request_id: requestId
    });

    if (error || !data) return fail("CLONE_TASK_FAILED", error?.message ?? "Clone Task ไม่สำเร็จ");
    revalidatePath("/");
    return ok(data as TaskSummary, "Clone Task สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function deleteTask(taskId: string) {
  return mutateTaskState(taskId, "DELETE_TASK", {
    is_deleted: true
  });
}

export async function archiveTask(taskId: string) {
  return mutateTaskState(taskId, "ARCHIVE_TASK", {
    is_archived: true,
    archived_at: new Date().toISOString()
  });
}

export async function restoreTask(taskId: string) {
  return mutateTaskState(taskId, "RESTORE_TASK", {
    is_archived: false,
    archived_at: null
  });
}

async function mutateTaskState(taskId: string, action: "DELETE_TASK" | "ARCHIVE_TASK" | "RESTORE_TASK", values: Record<string, unknown>) {
  try {
    uuidSchema.parse(taskId);
    const user = await requireUser();
    const supabase = await createClient();
    const { data: currentTask } = await supabase.from("tasks").select("owner_id").eq("id", taskId).single();
    if (!currentTask || currentTask.owner_id !== user.id) {
      return fail("OWNER_REQUIRED", "เฉพาะเจ้าของ Task เท่านั้นที่ทำรายการนี้ได้");
    }
    const { data, error } = await supabase.from("tasks").update(values).eq("id", taskId).select("*").single();
    if (error || !data) return fail(`${action}_FAILED`, error?.message ?? "ทำรายการไม่สำเร็จ");
    await supabase.from("activity_logs").insert({ task_id: taskId, user_id: user.id, action, detail_json: values });
    if (action !== "DELETE_TASK") {
      const eventType = action === "ARCHIVE_TASK" ? "TASK_ARCHIVED" : "TASK_RESTORED";
      const notification = await supabase.rpc("emit_task_notification", {
        target_task_id: taskId,
        target_event_type: eventType,
        event_payload: {}
      });
      if (notification.error) {
        revalidatePath("/");
        return ok(data, "ทำรายการสำเร็จ แต่สร้างการแจ้งเตือนไม่สำเร็จ");
      }
    }
    revalidatePath("/");
    return ok(data, "ทำรายการสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}
