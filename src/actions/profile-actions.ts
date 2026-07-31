"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fail, ok, toErrorResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { passwordUpdateSchema, profileUpdateSchema } from "@/lib/validators";

const AVATAR_LIMIT = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function updateOwnProfile(payload: unknown) {
  try {
    await requireUser();
    const input = profileUpdateSchema.parse(payload);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_own_profile", {
      next_display_name: input.display_name,
      next_contact_info: input.contact_info || null
    });

    if (error || !data) return fail("UPDATE_PROFILE_FAILED", error?.message ?? "บันทึกข้อมูลส่วนตัวไม่สำเร็จ");
    revalidatePath("/", "layout");
    return ok(data, "บันทึกข้อมูลส่วนตัวแล้ว");
  } catch (error) {
    return toErrorResult(error, "บันทึกข้อมูลส่วนตัวไม่สำเร็จ");
  }
}

export async function uploadProfileAvatar(formData: FormData) {
  try {
    const user = await requireUser();
    const avatar = formData.get("avatar");

    if (!(avatar instanceof File) || avatar.size === 0) {
      return fail("AVATAR_REQUIRED", "กรุณาเลือกรูปโปรไฟล์");
    }
    if (!AVATAR_TYPES.has(avatar.type)) {
      return fail("INVALID_AVATAR_TYPE", "รองรับเฉพาะไฟล์ JPG, PNG และ WebP");
    }
    if (avatar.size > AVATAR_LIMIT) {
      return fail("AVATAR_TOO_LARGE", "รูปโปรไฟล์ต้องมีขนาดไม่เกิน 2 MB");
    }

    const supabase = await createClient();
    const path = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatar, {
      cacheControl: "3600",
      contentType: avatar.type,
      upsert: true
    });
    if (uploadError) return fail("UPLOAD_AVATAR_FAILED", uploadError.message);

    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
    const { data, error } = await supabase.rpc("set_own_avatar_url", { next_avatar_url: avatarUrl });
    if (error || !data) return fail("SAVE_AVATAR_FAILED", error?.message ?? "บันทึกรูปโปรไฟล์ไม่สำเร็จ");

    revalidatePath("/", "layout");
    return ok({ profile: data, avatar_url: avatarUrl }, "อัปเดตรูปโปรไฟล์แล้ว");
  } catch (error) {
    return toErrorResult(error, "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ");
  }
}

export async function sendOwnPasswordResetLink() {
  try {
    const user = await requireUser();
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const requestOrigin = host ? `${protocol}://${host}` : "";
    const origin = requestOrigin || configuredOrigin || "";
    if (!origin) return fail("SITE_URL_MISSING", "ไม่พบ URL ของเว็บไซต์สำหรับสร้างลิงก์เปลี่ยนรหัสผ่าน");

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${origin}/auth/callback?next=/update-password`
    });
    if (error) {
      const isRateLimited = error.message.toLowerCase().includes("rate limit");
      return fail(
        isRateLimited ? "RESET_EMAIL_RATE_LIMITED" : "RESET_EMAIL_FAILED",
        isRateLimited ? "ส่งอีเมลบ่อยเกินไป กรุณารอแล้วลองใหม่อีกครั้ง" : error.message
      );
    }
    return ok(null, "ส่งลิงก์เปลี่ยนรหัสผ่านไปยังอีเมลแล้ว");
  } catch (error) {
    return toErrorResult(error, "ส่งลิงก์เปลี่ยนรหัสผ่านไม่สำเร็จ");
  }
}

export async function updateRecoveredPassword(payload: unknown) {
  try {
    await requireUser();
    const input = passwordUpdateSchema.parse(payload);
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) return fail("UPDATE_PASSWORD_FAILED", error.message);

    const { data: changedAt, error: timestampError } = await supabase.rpc("mark_password_changed");
    if (timestampError) return fail("SAVE_PASSWORD_DATE_FAILED", timestampError.message);
    revalidatePath("/", "layout");
    return ok(changedAt, "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
  } catch (error) {
    return toErrorResult(error, "เปลี่ยนรหัสผ่านไม่สำเร็จ");
  }
}

export async function signOutAllDevices() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
