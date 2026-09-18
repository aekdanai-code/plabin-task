import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TASK_IMAGE_BUCKET } from "@/lib/task-media";
import { uuidSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return new Response("Not found", { status: 404 });
  if (!await getCurrentUser()) return new Response("Unauthorized", { status: 401 });
  const supabase = await createClient();
  const { data: image, error } = await supabase.from("task_images").select("storage_path,mime_type").eq("id", id).eq("is_removed", false).single();
  if (error || !image) return new Response("Not found", { status: 404 });
  const { data, error: downloadError } = await supabase.storage.from(TASK_IMAGE_BUCKET).download(image.storage_path);
  if (downloadError || !data) return new Response("Not found", { status: 404 });
  let bytes: Uint8Array = new Uint8Array(await data.arrayBuffer());
  let mime = image.mime_type;
  if (new URL(request.url).searchParams.get("thumbnail") === "1") {
    try {
      bytes = new Uint8Array(await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize(480, 360, { fit: "cover", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
      mime = "image/webp";
    } catch { return new Response("Invalid image", { status: 422 }); }
  }
  // Recheck membership on each request; no public URLs or stale signed links.
  return new Response(bytes as BodyInit, { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
