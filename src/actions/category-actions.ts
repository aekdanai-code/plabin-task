"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { categorySchema, uuidSchema } from "@/lib/validators";
import { fail, ok, toErrorResult } from "@/lib/result";

export async function getCategories() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
    if (error) return fail("LOAD_CATEGORIES_FAILED", error.message);
    return ok(data ?? [], "โหลดหมวดหมู่สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function createCategory(payload: unknown) {
  try {
    const input = categorySchema.parse(payload);
    const user = await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.from("categories").insert({ ...input, owner_id: user.id }).select("*").single();
    if (error || !data) return fail("CREATE_CATEGORY_FAILED", error?.message ?? "สร้างหมวดหมู่ไม่สำเร็จ");
    await supabase.from("activity_logs").insert({ user_id: user.id, action: "CREATE_CATEGORY", detail_json: { category_id: data.id } });
    revalidatePath("/");
    return ok(data, "สร้างหมวดหมู่สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateCategory(categoryId: string, payload: unknown) {
  try {
    uuidSchema.parse(categoryId);
    const input = categorySchema.parse(payload);
    const user = await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.from("categories").update(input).eq("id", categoryId).select("*").single();
    if (error || !data) return fail("UPDATE_CATEGORY_FAILED", error?.message ?? "แก้ไขหมวดหมู่ไม่สำเร็จ");
    await supabase.from("activity_logs").insert({ user_id: user.id, action: "UPDATE_CATEGORY", detail_json: { category_id: categoryId } });
    revalidatePath("/");
    return ok(data, "แก้ไขหมวดหมู่สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function deactivateCategory(categoryId: string) {
  try {
    uuidSchema.parse(categoryId);
    const user = await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.from("categories").update({ is_active: false }).eq("id", categoryId).select("*").single();
    if (error || !data) return fail("DEACTIVATE_CATEGORY_FAILED", error?.message ?? "ปิดหมวดหมู่ไม่สำเร็จ");
    await supabase.from("activity_logs").insert({ user_id: user.id, action: "DEACTIVATE_CATEGORY", detail_json: { category_id: categoryId } });
    revalidatePath("/");
    return ok(data, "ปิดหมวดหมู่สำเร็จ");
  } catch (error) {
    return toErrorResult(error);
  }
}
