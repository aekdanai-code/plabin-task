"use server";

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
        "*, categories(*), checklist_items(*), task_shares(*, profile:profiles!task_shares_user_id_fkey(id,email,display_name,avatar_url))"
      )
      .eq("id", taskId)
      .eq("is_deleted", false)
      .single();

    if (error || !data) return fail("TASK_NOT_FOUND", "ไม่พบ Task หรือคุณไม่มีสิทธิ์เข้าถึง");

    const mapped = mapTask(data as unknown as TaskRow, user.id) as TaskDetail;
    mapped.checklist_items = ((data as { checklist_items?: TaskDetail["checklist_items"] }).checklist_items ?? []).sort(
      (a, b) => a.sort_order - b.sort_order
    );
    mapped.shares = ((data as { task_shares?: TaskDetail["shares"] }).task_shares ?? []).filter((share) => share.is_active);
    return ok(mapped, "โหลดรายละเอียดสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function createTask(payload: unknown, requestId: string): Promise<ActionResult<TaskSummary>> {
  try {
    const input = taskInputSchema.parse(payload);
    uuidSchema.parse(requestId);
    await requireUser();
    const supabase = await createClient();

    const { data: task, error } = await supabase.rpc("create_task_with_items", {
      next_task_name: input.task_name,
      next_description: input.description || "",
      next_category_id: input.category_id,
      next_checklist_items: input.checklist_items,
      next_task_shares: input.shares,
      request_id: requestId
    });

    if (error || !task) return fail("CREATE_TASK_FAILED", error?.message ?? "สร้าง Task ไม่สำเร็จ");
    if (input.due_at) {
      const dueUpdate = await supabase.from("tasks").update({ due_at: input.due_at, due_timezone: "Asia/Bangkok" }).eq("id", task.id);
      if (dueUpdate.error) return fail("CREATE_TASK_DUE_DATE_FAILED", dueUpdate.error.message);
      task.due_at = input.due_at;
      task.due_timezone = "Asia/Bangkok";
    }
    revalidatePath("/");
    return ok(task as TaskSummary, "สร้าง Task สำเร็จ");
  } catch (error) {
    return toErrorResult(error, "ข้อมูล Task ไม่ถูกต้อง");
  }
}

export async function updateTask(taskId: string, payload: unknown, requestId: string): Promise<ActionResult<TaskSummary>> {
  try {
    uuidSchema.parse(taskId);
    uuidSchema.parse(requestId);
    const input = taskUpdateSchema.parse(payload);
    await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("update_task_with_items", {
      target_task_id: taskId,
      next_task_name: input.task_name,
      next_description: input.description || "",
      next_category_id: input.category_id,
      next_checklist_items: input.checklist_items,
      next_task_shares: input.shares ?? null,
      request_id: requestId
    });

    if (error || !data) return fail("UPDATE_TASK_FAILED", error?.message ?? "แก้ไข Task ไม่สำเร็จ");
    const { error: dueError } = await supabase
      .from("tasks")
      .update({ due_at: input.due_at || null, due_timezone: "Asia/Bangkok" })
      .eq("id", taskId);
    if (dueError) return fail("UPDATE_TASK_DUE_DATE_FAILED", dueError.message);
    const notification = await supabase.rpc("emit_task_notification", {
      target_task_id: taskId,
      target_event_type: "TASK_EDITED",
      event_payload: { request_id: requestId }
    });
    const notificationWarning = notification.error ? " แต่สร้างการแจ้งเตือนไม่สำเร็จ" : "";
    revalidatePath("/");
    return ok(data as TaskSummary, `แก้ไข Task สำเร็จ${notificationWarning}`);
  } catch (error) {
    return toErrorResult(error);
  }
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
