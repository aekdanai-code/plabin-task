"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fail, ok, toErrorResult } from "@/lib/result";
import { checklistInputSchema, uuidSchema } from "@/lib/validators";

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

export async function toggleChecklistItem(itemId: string, isChecked: boolean) {
  try {
    uuidSchema.parse(itemId);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("checklist_items")
      .update({
        is_checked: isChecked,
        checked_by: isChecked ? user.id : null,
        checked_at: isChecked ? new Date().toISOString() : null
      })
      .eq("id", itemId)
      .select("*")
      .single();
    if (error || !data) return fail("TOGGLE_ITEM_FAILED", error?.message ?? "อัปเดตรายการไม่สำเร็จ");
    await afterChecklistMutation(data.task_id, user.id, isChecked ? "CHECK_ITEM" : "UNCHECK_ITEM");
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

export async function reorderChecklistItems(taskId: string, orderedItemIds: string[]) {
  try {
    uuidSchema.parse(taskId);
    orderedItemIds.forEach((id) => uuidSchema.parse(id));
    const user = await requireUser();
    const supabase = await createClient();

    await Promise.all(
      orderedItemIds.map((id, index) =>
        supabase.from("checklist_items").update({ sort_order: index + 1 }).eq("id", id).eq("task_id", taskId)
      )
    );

    await afterChecklistMutation(taskId, user.id, "REORDER_ITEMS");
    return ok({ orderedItemIds }, "เรียงลำดับสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

async function afterChecklistMutation(taskId: string, userId: string, action: string) {
  const supabase = await createClient();
  await supabase.from("activity_logs").insert({ task_id: taskId, user_id: userId, action, detail_json: {} });
  revalidatePath("/");
}
