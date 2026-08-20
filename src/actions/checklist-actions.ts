"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fail, ok, toErrorResult } from "@/lib/result";
import { checklistInputSchema, checklistNoteSchema, uuidSchema } from "@/lib/validators";

export async function addChecklistNote(itemId: string, payload: unknown) {
  try {
    uuidSchema.parse(itemId);
    const input = checklistNoteSchema.parse(payload);
    const user = await requireUser();
    const supabase = await createClient();
    const { data: item, error: itemError } = await supabase
      .from("checklist_items")
      .select("task_id")
      .eq("id", itemId)
      .eq("is_deleted", false)
      .single();

    if (itemError || !item) return fail("CHECKLIST_ITEM_NOT_FOUND", "ไม่พบ Checklist หรือคุณไม่มีสิทธิ์เข้าถึง");

    const { data, error } = await supabase
      .from("checklist_notes")
      .insert({ checklist_item_id: itemId, author_id: user.id, content: input.content })
      .select("*, author:profiles!checklist_notes_author_id_fkey(id,email,display_name,avatar_url)")
      .single();

    if (error || !data) return fail("ADD_NOTE_FAILED", error?.message ?? "เพิ่มหมายเหตุไม่สำเร็จ");
    revalidatePath("/");
    return ok(data, "เพิ่มหมายเหตุสำเร็จ");
  } catch (error) {
    return toErrorResult(error, "ข้อมูลหมายเหตุไม่ถูกต้อง");
  }
}

export async function addChecklistItem(taskId: string, payload: unknown) {
  try {
    uuidSchema.parse(taskId);
    const input = checklistInputSchema.parse(payload);
    const user = await requireUser();
    const supabase = await createClient();
    const { count } = await supabase.from("checklist_items").select("id", { count: "exact", head: true }).eq("task_id", taskId);
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({ task_id: taskId, item_name: input.item_name, weight: input.weight, sort_order: (count ?? 0) + 1 })
      .select("*")
      .single();
    if (error || !data) return fail("ADD_ITEM_FAILED", error?.message ?? "เพิ่มรายการไม่สำเร็จ");
    await afterChecklistMutation(taskId, user.id, "ADD_ITEM");
    return ok(data, "เพิ่มรายการสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateChecklistItem(itemId: string, payload: unknown) {
  try {
    uuidSchema.parse(itemId);
    const input = checklistInputSchema.parse(payload);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ item_name: input.item_name, weight: input.weight })
      .eq("id", itemId)
      .select("*")
      .single();
    if (error || !data) return fail("UPDATE_ITEM_FAILED", error?.message ?? "แก้ไขรายการไม่สำเร็จ");
    await afterChecklistMutation(data.task_id, user.id, "UPDATE_ITEM");
    return ok(data, "แก้ไขรายการสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function toggleChecklistItem(itemId: string, isChecked: boolean, requestId: string) {
  try {
    uuidSchema.parse(itemId);
    uuidSchema.parse(requestId);
    await requireUser();
    const supabase = await createClient();
    const { data: beforeItem } = await supabase
      .from("checklist_items")
      .select("task_id,item_name,tasks(status)")
      .eq("id", itemId)
      .single();
    const { data, error } = await supabase.rpc("toggle_checklist_item", {
      target_item_id: itemId,
      next_checked: isChecked,
      request_id: requestId
    });
    if (error || !data) return fail("TOGGLE_ITEM_FAILED", error?.message ?? "อัปเดตรายการไม่สำเร็จ");
    const taskId = data.task_id ?? beforeItem?.task_id;
    if (taskId) {
      const checklistNotification = await supabase.rpc("emit_task_notification", {
        target_task_id: taskId,
        target_event_type: isChecked ? "CHECKLIST_CHECKED" : "CHECKLIST_UNCHECKED",
        event_payload: { checklist_item_name: data.item_name ?? beforeItem?.item_name ?? "Checklist", request_id: requestId }
      });
      const notificationWarning = checklistNotification.error ? " แต่สร้างการแจ้งเตือนไม่สำเร็จ" : "";

      const { data: currentTask } = await supabase.from("tasks").select("status").eq("id", taskId).single();
      const beforeTaskRelation = beforeItem?.tasks as unknown as { status?: string } | Array<{ status?: string }> | null | undefined;
      const previousStatus = Array.isArray(beforeTaskRelation) ? beforeTaskRelation[0]?.status : beforeTaskRelation?.status;
      if (currentTask?.status === "COMPLETED" && previousStatus !== "COMPLETED") {
        await supabase.rpc("emit_task_notification", { target_task_id: taskId, target_event_type: "TASK_COMPLETED", event_payload: {} });
      } else if (previousStatus === "COMPLETED" && currentTask?.status !== "COMPLETED") {
        await supabase.rpc("emit_task_notification", { target_task_id: taskId, target_event_type: "TASK_REOPENED", event_payload: {} });
      }
      if (notificationWarning) {
        revalidatePath("/");
        return ok(data, `อัปเดตรายการสำเร็จ${notificationWarning}`);
      }
    }
    revalidatePath("/");
    return ok(data, "อัปเดตรายการสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function deleteChecklistItem(itemId: string) {
  try {
    uuidSchema.parse(itemId);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ is_deleted: true })
      .eq("id", itemId)
      .select("*")
      .single();
    if (error || !data) return fail("DELETE_ITEM_FAILED", error?.message ?? "ลบรายการไม่สำเร็จ");
    await afterChecklistMutation(data.task_id, user.id, "DELETE_ITEM");
    return ok(data, "ลบรายการสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function reorderChecklistItems(taskId: string, orderedItemIds: string[], requestId: string) {
  try {
    uuidSchema.parse(taskId);
    uuidSchema.parse(requestId);
    orderedItemIds.forEach((id) => uuidSchema.parse(id));
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reorder_checklist_items", {
      target_task_id: taskId,
      ordered_item_ids: orderedItemIds,
      request_id: requestId
    });
    if (error || !data) return fail("REORDER_ITEMS_FAILED", error?.message ?? "เรียงลำดับไม่สำเร็จ");
    revalidatePath("/");
    return ok({ orderedItemIds: data }, "เรียงลำดับสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

async function afterChecklistMutation(taskId: string, userId: string, action: string) {
  const supabase = await createClient();
  await supabase.from("activity_logs").insert({ task_id: taskId, user_id: userId, action, detail_json: {} });
  revalidatePath("/");
}
