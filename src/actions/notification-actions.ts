"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, toErrorResult } from "@/lib/result";
import { uuidSchema } from "@/lib/validators";
import type { AppNotification } from "@/types/app";

export async function getNotifications() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("is_in_app_visible", true)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return fail("LOAD_NOTIFICATIONS_FAILED", error.message);
    return ok((data ?? []) as AppNotification[], "โหลดการแจ้งเตือนสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    uuidSchema.parse(notificationId);
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId);
    if (error) return fail("MARK_NOTIFICATION_FAILED", error.message);
    revalidatePath("/");
    return ok(null, "อ่านการแจ้งเตือนแล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function markAllNotificationsRead() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("is_read", false);
    if (error) return fail("MARK_NOTIFICATIONS_FAILED", error.message);
    revalidatePath("/");
    return ok(null, "อ่านการแจ้งเตือนทั้งหมดแล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function notifyTaskTeam(taskId: string) {
  try {
    uuidSchema.parse(taskId);
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("emit_task_notification", {
      target_task_id: taskId,
      target_event_type: "TASK_UPDATED_MANUAL",
      event_payload: {}
    });
    if (error) return fail("NOTIFY_TEAM_FAILED", error.message);
    return ok(Number(data ?? 0), `แจ้งเตือนสมาชิก ${Number(data ?? 0)} คนแล้ว`);
  } catch (error) {
    return toErrorResult(error);
  }
}
