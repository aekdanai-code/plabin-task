"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, toErrorResult } from "@/lib/result";
import { notificationPreferencesSchema, uuidSchema } from "@/lib/validators";
import type { AppNotification, NotificationPreferences } from "@/types/app";

export async function getNotifications() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return fail("LOAD_NOTIFICATIONS_FAILED", error.message);
    return ok((data ?? []) as AppNotification[], "โหลดการแจ้งเตือนสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function getNotificationPreferences() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("task_shared,task_updated")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return fail("LOAD_NOTIFICATION_PREFERENCES_FAILED", error.message);
    return ok(
      (data ?? { task_shared: true, task_updated: true }) as NotificationPreferences,
      "โหลดการตั้งค่าการแจ้งเตือนสำเร็จ"
    );
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateNotificationPreferences(payload: unknown) {
  try {
    const input = notificationPreferencesSchema.parse(payload);
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...input }, { onConflict: "user_id" })
      .select("task_shared,task_updated")
      .single();
    if (error || !data) {
      return fail("UPDATE_NOTIFICATION_PREFERENCES_FAILED", error?.message ?? "บันทึกการตั้งค่าไม่สำเร็จ");
    }
    revalidatePath("/");
    return ok(data as NotificationPreferences, "บันทึกการตั้งค่าการแจ้งเตือนแล้ว");
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
    const { data, error } = await supabase.rpc("notify_task_team", { target_task_id: taskId });
    if (error) return fail("NOTIFY_TEAM_FAILED", error.message);
    return ok(Number(data ?? 0), `แจ้งเตือนสมาชิก ${Number(data ?? 0)} คนแล้ว`);
  } catch (error) {
    return toErrorResult(error);
  }
}
