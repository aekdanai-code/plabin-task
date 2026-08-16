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
      .eq("is_in_app_visible", true)
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
    const [legacy, normalized] = await Promise.all([
      supabase.from("notification_preferences").select("task_shared,task_updated").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("user_notification_preferences")
        .select("event_type,in_app_enabled")
        .eq("user_id", user.id)
        .in("event_type", ["TASK_SHARED", "TASK_UPDATED_MANUAL"])
    ]);
    if (legacy.error || normalized.error) return fail("LOAD_NOTIFICATION_PREFERENCES_FAILED", legacy.error?.message ?? normalized.error?.message ?? "โหลดไม่สำเร็จ");
    const shared = normalized.data?.find((row) => row.event_type === "TASK_SHARED")?.in_app_enabled;
    const updated = normalized.data?.find((row) => row.event_type === "TASK_UPDATED_MANUAL")?.in_app_enabled;
    return ok(
      {
        task_shared: shared ?? legacy.data?.task_shared ?? true,
        task_updated: updated ?? legacy.data?.task_updated ?? true
      } as NotificationPreferences,
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
    const { data: existingNormalized, error: existingNormalizedError } = await supabase
      .from("user_notification_preferences")
      .select("event_type,email_enabled,line_enabled")
      .eq("user_id", user.id)
      .in("event_type", ["TASK_SHARED", "TASK_UPDATED_MANUAL"]);
    if (existingNormalizedError) return fail("UPDATE_NOTIFICATION_PREFERENCES_FAILED", existingNormalizedError.message);
    const currentShared = existingNormalized?.find((row) => row.event_type === "TASK_SHARED");
    const currentUpdated = existingNormalized?.find((row) => row.event_type === "TASK_UPDATED_MANUAL");
    const { error: normalizedError } = await supabase.from("user_notification_preferences").upsert(
      [
        {
          user_id: user.id,
          event_type: "TASK_SHARED",
          in_app_enabled: input.task_shared,
          email_enabled: currentShared?.email_enabled ?? true,
          line_enabled: currentShared?.line_enabled ?? true
        },
        {
          user_id: user.id,
          event_type: "TASK_UPDATED_MANUAL",
          in_app_enabled: input.task_updated,
          email_enabled: currentUpdated?.email_enabled ?? true,
          line_enabled: currentUpdated?.line_enabled ?? true
        }
      ],
      { onConflict: "user_id,event_type" }
    );
    if (normalizedError) return fail("UPDATE_NOTIFICATION_PREFERENCES_FAILED", normalizedError.message);
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
