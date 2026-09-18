"use server";

import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fail, ok, toErrorResult } from "@/lib/result";
import { uuidSchema } from "@/lib/validators";
import { imageValidationError, TASK_IMAGE_BUCKET, type TaskImage } from "@/lib/task-media";
import type { ActionResult } from "@/types/app";

export async function uploadTaskImage(formData: FormData): Promise<ActionResult<TaskImage>> {
  try {
    await requireUser();
    const id = uuidSchema.parse(formData.get("image_id"));
    const targetTaskId = formData.get("task_id") ? uuidSchema.parse(formData.get("task_id")) : null;
    const file = formData.get("image");
    if (!(file instanceof File)) return fail("IMAGE_REQUIRED", "กรุณาเลือกรูปภาพ");
    const validationError = imageValidationError(file);
    if (validationError) return fail("INVALID_IMAGE", validationError);
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const image = sharp(bytes, { limitInputPixels: 40000000, failOn: "warning" });
      const meta = await image.metadata();
      const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[file.type];
      if (meta.format !== expected || (meta.pages ?? 1) > 1) throw new Error();
      await image.resize(1, 1).toBuffer(); // Force decoding; headers/MIME alone aren't sufficient.
    } catch { return fail("INVALID_IMAGE_CONTENT", "ไฟล์ไม่ใช่รูปภาพที่สมบูรณ์ หรือเป็นภาพเคลื่อนไหว/เกิน 40 ล้านพิกเซล"); }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reserve_task_image", {
      next_id: id, target_task_id: targetTaskId, next_file_name: file.name.slice(0, 255), next_mime_type: file.type, next_size: file.size
    });
    if (error || !data) return fail("RESERVE_IMAGE_FAILED", error?.message.includes("TOO_MANY_PENDING_IMAGES") ? "มีรูปที่ยังไม่ได้บันทึกจำนวนมาก กรุณาปิดฟอร์มอื่นแล้วลองใหม่" : "เตรียมอัปโหลดไม่สำเร็จ กรุณาตรวจสิทธิ์และลองใหม่");
    const row = data as TaskImage;
    const storage = supabase.storage.from(TASK_IMAGE_BUCKET);
    const { error: uploadError } = await storage.upload(row.storage_path, bytes, { contentType: file.type, cacheControl: "0", upsert: false });
    if (uploadError) {
      // A response may be lost after upload succeeds. Retry the same ID safely.
      const existing = await storage.download(row.storage_path);
      if (!existing.data || !Buffer.from(await existing.data.arrayBuffer()).equals(bytes)) return fail("UPLOAD_IMAGE_FAILED", "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
    }
    return ok(row, "อัปโหลดรูปแล้ว");
  } catch (error) { return toErrorResult(error, "อัปโหลดรูปไม่สำเร็จ"); }
}

export async function discardTaskImages(ids: string[]) {
  try {
    await requireUser();
    if (ids.length > 30) return fail("TOO_MANY_IMAGES", "จำนวนรูปไม่ถูกต้อง");
    ids.forEach(id => uuidSchema.parse(id));
    const supabase = await createClient();
    const { error } = await supabase.rpc("discard_task_images", { image_ids: ids });
    if (error) return fail("DISCARD_IMAGES_FAILED", "นำรูปชั่วคราวออกไม่สำเร็จ");
    const { data } = await supabase.from("task_images").select("storage_path").in("id", ids).is("task_id", null).eq("is_removed", true);
    if (data?.length) {
      const result = await supabase.storage.from(TASK_IMAGE_BUCKET).remove(data.map(row => row.storage_path));
      if (result.error) return fail("REMOVE_FILES_FAILED", "ลบไฟล์ชั่วคราวไม่สำเร็จ");
    }
    return ok(null);
  } catch (error) { return toErrorResult(error); }
}
