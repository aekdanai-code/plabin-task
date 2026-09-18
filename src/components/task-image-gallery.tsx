"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { taskImageUrl, type TaskImage } from "@/lib/task-media";

export type GalleryImage = { id: string; name: string; src: string; thumbnail?: string };

export function ImageLightbox({ images, index, onIndexChange, onClose }: { images: GalleryImage[]; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);
  const image = images[index];
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; opener?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { setFailed(false); if ((document.activeElement as HTMLButtonElement | null)?.disabled) closeButton.current?.focus(); }, [index]);
  if (!image) return null;
  return <dialog ref={dialog} aria-labelledby="task-image-modal-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => {
    if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose(); }
  }} onKeyDown={e => {
    if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); onIndexChange(index - 1); }
    if (e.key === "ArrowRight" && index < images.length - 1) { e.preventDefault(); onIndexChange(index + 1); }
  }} className="m-auto max-h-[94dvh] w-[calc(100%-1rem)] max-w-5xl overflow-y-auto rounded-xl bg-white p-0 shadow-panel backdrop:bg-black/70">
    <div className="flex items-start justify-between gap-3 border-b border-apple-line p-4">
      <div className="min-w-0"><h3 id="task-image-modal-title" className="break-words font-semibold">{image.name}</h3><p className="mt-1 text-xs text-apple-muted" aria-live="polite">ภาพที่ {index + 1} จาก {images.length}</p></div>
      <button ref={closeButton} type="button" onClick={onClose} aria-label="ปิดภาพเต็ม" className="rounded-lg bg-apple-bg p-2.5"><X className="h-5 w-5" /></button>
    </div>
    <div className="flex min-h-48 items-center justify-center bg-apple-bg p-2 sm:p-4">
      {failed ? <p role="alert" className="p-6 text-sm text-apple-red">โหลดรูปไม่สำเร็จ กรุณาปิดแล้วลองเปิดรูปอีกครั้ง</p> : <img src={image.src} alt={image.name} onError={() => setFailed(true)} className="max-h-[68dvh] w-full object-contain" />}
    </div>
    <div className="flex items-center justify-between gap-2 p-4">
      <button type="button" disabled={index === 0} onClick={() => onIndexChange(index - 1)} className="flex items-center gap-1 rounded-lg bg-apple-bg px-3 py-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />ก่อนหน้า</button>
      <span className="text-xs text-apple-muted">ภาพเต็ม ไม่ครอป</span>
      <button type="button" disabled={index === images.length - 1} onClick={() => onIndexChange(index + 1)} className="flex items-center gap-1 rounded-lg bg-apple-bg px-3 py-2 text-sm disabled:opacity-40">ถัดไป<ChevronRight className="h-4 w-4" /></button>
    </div>
  </dialog>;
}

export function TaskImageGallery({ images }: { images: TaskImage[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!images.length) return null;
  const gallery = images.map(image => ({ id: image.id, name: image.file_name, src: taskImageUrl(image.id), thumbnail: taskImageUrl(image.id, true) }));
  return <section className="mt-5" aria-label="รูปภาพแนบ">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">รูปภาพแนบ · {images.length} รูป</h3><span className="text-xs text-apple-muted">กดที่ภาพเพื่อดูขนาดเต็ม</span></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {gallery.map((image, index) => <figure key={image.id} className="min-w-0"><button type="button" onClick={() => setSelected(index)} aria-label={`เปิดภาพเต็ม ${image.name}`} className="relative block w-full overflow-hidden rounded-lg border border-apple-line bg-apple-bg hover:border-apple-blue"><img src={image.thumbnail} alt={image.name} loading="lazy" className="aspect-[4/3] w-full object-cover" /><span className="absolute bottom-1.5 right-1.5 rounded bg-white/95 p-1"><Expand className="h-3.5 w-3.5" /></span></button><figcaption className="mt-1.5 truncate text-xs text-apple-muted" title={image.name}>{image.name}</figcaption></figure>)}
    </div>
    {selected !== null ? <ImageLightbox images={gallery} index={selected} onIndexChange={setSelected} onClose={() => setSelected(null)} /> : null}
  </section>;
}
