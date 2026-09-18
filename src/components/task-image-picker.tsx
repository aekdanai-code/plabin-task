"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { imageValidationError, TASK_IMAGE_MAX_COUNT, TASK_IMAGE_TYPES } from "@/lib/task-media";
import { ImageLightbox } from "@/components/task-image-gallery";

export type DraftTaskImage = {
  id: string;
  name: string;
  preview: string;
  thumbnail?: string;
  file?: File;
  uploaded: boolean;
  status?: "uploading" | "error";
  error?: string;
};

export function TaskImagePicker({ images, disabled, onChange, onRetry, onReadingChange }: { images: DraftTaskImage[]; disabled: boolean; onChange: (images: DraftTaskImage[]) => void; onRetry: (id: string) => void; onReadingChange: (reading: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const selecting = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  async function selectFiles(files: File[]) {
    if (disabled || selecting.current) return;
    selecting.current = true; setReading(true); onReadingChange(true);
    const next = [...images], failures: string[] = [];
    try {
      for (const file of files) {
        const error = imageValidationError(file);
        if (error) { failures.push(`${file.name}: ${error}`); continue; }
        if (next.length >= TASK_IMAGE_MAX_COUNT) { failures.push(`เลือกได้สูงสุด ${TASK_IMAGE_MAX_COUNT} รูปต่อ Task`); break; }
        if (next.some(image => image.file?.name === file.name && image.file?.size === file.size && image.file?.lastModified === file.lastModified)) { failures.push(`${file.name}: เลือกไฟล์นี้แล้ว`); continue; }
        const preview = URL.createObjectURL(file);
        try { const check = new Image(); check.src = preview; await check.decode(); if (check.naturalWidth * check.naturalHeight > 40000000) throw new Error(); }
        catch { URL.revokeObjectURL(preview); failures.push(`${file.name}: อ่านรูปไม่ได้หรือความละเอียดเกิน 40 ล้านพิกเซล`); continue; }
        next.push({ id: crypto.randomUUID(), name: file.name, preview, file, uploaded: false });
      }
      onChange(next); setErrors(failures);
    } finally { selecting.current = false; setReading(false); onReadingChange(false); if (input.current) input.current.value = ""; }
  }
  function move(index: number, offset: number) { const next = [...images]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); }
  return <section aria-label="แกลเลอรีรูปภาพ">
    <div className="mb-2 flex justify-between gap-2 text-sm"><span className="font-medium">แกลเลอรีรูปภาพ</span><span className="text-apple-muted">{images.length} / {TASK_IMAGE_MAX_COUNT} รูป</span></div>
    <div onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); void selectFiles(Array.from(e.dataTransfer.files)); }} className={`rounded-lg border border-dashed p-4 text-center ${over ? "border-apple-blue bg-apple-blue/5" : "border-apple-line bg-apple-bg"}`}>
      <button type="button" disabled={disabled || reading || images.length >= TASK_IMAGE_MAX_COUNT} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-apple-blue disabled:opacity-40"><ImagePlus className="h-4 w-4" />{reading ? "กำลังตรวจสอบรูป…" : "เลือกรูปภาพ"}</button>
      <p className="mt-2 text-xs text-apple-muted">ลากรูปมาวางได้ · JPG, PNG, WebP · ไม่เกิน 3 MB ต่อรูป</p>
      <input ref={input} type="file" multiple accept={TASK_IMAGE_TYPES.join(",")} className="hidden" disabled={disabled || reading} aria-label="เลือกรูปภาพแนบ Task" onChange={e => void selectFiles(Array.from(e.target.files ?? []))} />
    </div>
    {errors.length ? <div role="alert" className="mt-2 text-sm text-apple-red">{errors.map((error, i) => <p key={i}>{error}</p>)}</div> : null}
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((image, index) => <div key={image.id} className="min-w-0 overflow-hidden rounded-lg border border-apple-line">
        <button type="button" aria-label={`ดูภาพ ${image.name}`} className="block w-full bg-apple-bg" onClick={() => setSelected(index)}><img src={image.thumbnail ?? image.preview} alt={image.name} className="aspect-[4/3] w-full object-cover" /></button>
        <div className="space-y-2 p-2"><p className="truncate text-xs text-apple-muted" title={image.name}>{image.name}</p>
          <div className="flex flex-wrap gap-1"><button type="button" disabled={disabled || reading || index === 0} onClick={() => move(index, -1)} aria-label={`เลื่อนรูป ${image.name} ก่อนหน้า`} className="rounded bg-apple-bg p-2 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" disabled={disabled || reading || index === images.length - 1} onClick={() => move(index, 1)} aria-label={`เลื่อนรูป ${image.name} ถัดไป`} className="rounded bg-apple-bg p-2 disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button><button type="button" disabled={disabled || reading} onClick={() => onChange(images.filter(row => row.id !== image.id))} aria-label={`นำรูป ${image.name} ออก`} className="rounded bg-apple-bg p-2 text-apple-red disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button></div>
          {image.status === "uploading" ? <p role="status" className="flex items-center gap-1 text-xs text-apple-blue"><Loader2 className="h-3 w-3 animate-spin" />กำลังอัปโหลด</p> : image.status === "error" ? <div><p role="alert" className="text-xs text-apple-red">{image.error}</p><button type="button" disabled={disabled} onClick={() => onRetry(image.id)} className="mt-1 text-xs font-semibold text-apple-blue">ลองใหม่</button></div> : <p className="text-xs text-apple-muted">{image.uploaded ? "พร้อมบันทึก" : "รออัปโหลดเมื่อบันทึก"}</p>}
        </div>
      </div>)}
    </div>
    {selected !== null && images[selected] ? <ImageLightbox images={images.map(image => ({ id: image.id, name: image.name, src: image.preview }))} index={selected} onIndexChange={setSelected} onClose={() => setSelected(null)} /> : null}
  </section>;
}
