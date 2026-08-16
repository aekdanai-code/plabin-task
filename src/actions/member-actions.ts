"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { fail, ok, toErrorResult } from "@/lib/result";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { memberUpdateSchema, uuidSchema } from "@/lib/validators";
import { normalizeEmail } from "@/lib/utils";
import type { MemberWithLineStatus, UserNotificationChannel } from "@/types/app";

export async function getMembers() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const [profiles, channels] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_notification_channels").select("user_id,line_link_status,line_linked_at")
    ]);
    const error = profiles.error ?? channels.error;
    if (error) return fail("LOAD_MEMBERS_FAILED", error.message);
    const channelByUser = new Map(
      ((channels.data ?? []) as Pick<UserNotificationChannel, "user_id" | "line_link_status" | "line_linked_at">[])
        .map((channel) => [channel.user_id, channel])
    );
    const members = (profiles.data ?? []).map((profile) => {
      const channel = channelByUser.get(profile.id);
      return {
        ...profile,
        line_link_status: channel?.line_link_status ?? "NOT_LINKED",
        line_linked_at: channel?.line_linked_at ?? null
      } as MemberWithLineStatus;
    });
    return ok(members, "โหลดสมาชิกสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function inviteMember(email: string) {
  try {
    const admin = await requireAdmin();
    const cleanEmail = normalizeEmail(email);
    const service = createServiceClient();
    const { data, error } = await service.auth.admin.inviteUserByEmail(cleanEmail);
    if (error) return fail("INVITE_MEMBER_FAILED", error.message);
    const supabase = await createClient();
    await supabase.from("activity_logs").insert({
      user_id: admin.id,
      action: "INVITE_MEMBER",
      detail_json: { invited_email: cleanEmail }
    });
    revalidatePath("/members");
    return ok(data, "ส่งคำเชิญสำเร็จ");
  } catch (error) {
    return toErrorResult(error, "ส่งคำเชิญไม่สำเร็จ");
  }
}

export async function updateMember(memberId: string, payload: unknown) {
  try {
    uuidSchema.parse(memberId);
    const input = memberUpdateSchema.parse(payload);
    const admin = await requireAdmin();
    const supabase = await createClient();
    if (memberId === admin.id && input.role && input.role !== "ADMIN") {
      return fail("INVALID_ACTION", "ไม่สามารถลดสิทธิ์ Admin ของตัวเองได้");
    }
    if (input.role === "USER") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) return fail("LAST_ADMIN", "ระบบต้องมี Admin ที่ใช้งานอยู่อย่างน้อย 1 คน");
    }
    const { data, error } = await supabase.from("profiles").update(input).eq("id", memberId).select("*").single();
    if (error || !data) return fail("UPDATE_MEMBER_FAILED", error?.message ?? "แก้ไขสมาชิกไม่สำเร็จ");
    await supabase.from("activity_logs").insert({
      user_id: admin.id,
      action: "UPDATE_MEMBER",
      detail_json: { member_id: memberId, changes: input }
    });
    revalidatePath("/members");
    return ok(data, "แก้ไขสมาชิกสำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function deactivateMember(memberId: string) {
  return setMemberActive(memberId, false);
}

export async function reactivateMember(memberId: string) {
  return setMemberActive(memberId, true);
}

async function setMemberActive(memberId: string, isActive: boolean) {
  try {
    uuidSchema.parse(memberId);
    const admin = await requireAdmin();
    if (memberId === admin.id && !isActive) return fail("INVALID_ACTION", "ไม่สามารถปิดใช้งานบัญชีตัวเองได้");
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", memberId).select("*").single();
    if (error || !data) return fail("UPDATE_MEMBER_FAILED", error?.message ?? "อัปเดตสมาชิกไม่สำเร็จ");
    await supabase.from("activity_logs").insert({
      user_id: admin.id,
      action: isActive ? "REACTIVATE_MEMBER" : "DEACTIVATE_MEMBER",
      detail_json: { member_id: memberId }
    });
    revalidatePath("/members");
    return ok(data, isActive ? "เปิดใช้งานสมาชิกแล้ว" : "ปิดใช้งานสมาชิกแล้ว");
  } catch (error) {
    return toErrorResult(error);
  }
}
