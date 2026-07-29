"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fail, ok, toErrorResult } from "@/lib/result";
import { shareSchema, uuidSchema } from "@/lib/validators";

export async function getTaskShares(taskId: string) {
  try {
    uuidSchema.parse(taskId);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("task_shares")
      .select("*, profile:profiles!task_shares_user_id_fkey(id,email,display_name,avatar_url)")
      .eq("task_id", taskId)
      .eq("is_active", true);
    if (error) return fail("LOAD_SHARES_FAILED", error.message);
    return ok(data ?? [], "โหลดผู้ร่วมงานสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function shareTask(taskId: string, payload: unknown) {
  try {
    uuidSchema.parse(taskId);
    const input = shareSchema.parse(payload);
    const user = await requireUser();
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("id,email").eq("id", input.user_id).eq("is_active", true).single();
    if (!profile) return fail("USER_NOT_FOUND", "ไม่พบสมาชิกอีเมลนี้ หรือสมาชิกถูกปิดใช้งาน");
    if (profile.id === user.id) return fail("INVALID_SHARE", "ไม่ต้องแชร์ Task ให้ตัวเอง");

    const { data: currentShares, error: loadError } = await supabase
      .from("task_shares")
      .select("user_id,permission,is_active")
      .eq("task_id", taskId)
      .eq("is_active", true);
    if (loadError) return fail("LOAD_SHARES_FAILED", loadError.message);

    const nextShares = (currentShares ?? [])
      .filter((share) => share.user_id !== input.user_id)
      .map((share) => ({ user_id: share.user_id, permission: share.permission }));
    nextShares.push({ user_id: input.user_id, permission: input.permission });

    const { error } = await supabase.rpc("set_task_shares", {
      target_task_id: taskId,
      next_task_shares: nextShares
    });
    if (error) return fail("SHARE_TASK_FAILED", error.message);
    revalidatePath("/");
    return ok({ task_id: taskId, ...input, shared_by: user.id }, "แชร์ Task สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateSharePermission(shareId: string, permission: "VIEWER" | "CHECKER" | "EDITOR") {
  try {
    uuidSchema.parse(shareId);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("task_shares").update({ permission }).eq("id", shareId).select("*").single();
    if (error || !data) return fail("UPDATE_PERMISSION_FAILED", error?.message ?? "แก้ไขสิทธิ์ไม่สำเร็จ");
    await supabase.from("activity_logs").insert({
      task_id: data.task_id,
      user_id: user.id,
      action: "UPDATE_PERMISSION",
      detail_json: { share_id: shareId, permission }
    });
    revalidatePath("/");
    return ok(data, "แก้ไขสิทธิ์สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function removeTaskShare(shareId: string) {
  try {
    uuidSchema.parse(shareId);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("task_shares").update({ is_active: false }).eq("id", shareId).select("*").single();
    if (error || !data) return fail("REMOVE_SHARE_FAILED", error?.message ?? "ลบผู้ร่วมงานไม่สำเร็จ");
    await supabase.from("activity_logs").insert({
      task_id: data.task_id,
      user_id: user.id,
      action: "REMOVE_SHARE",
      detail_json: { share_id: shareId }
    });
    revalidatePath("/");
    return ok(data, "ลบผู้ร่วมงานสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}
