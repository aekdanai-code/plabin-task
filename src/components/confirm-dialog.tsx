"use client";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "ยืนยัน",
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-panel sm:rounded-lg">
        <h2 className="text-xl font-semibold text-apple-text">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-apple-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-full bg-apple-bg px-5 py-2.5 text-sm font-semibold text-apple-text" onClick={onCancel}>
            ยกเลิก
          </button>
          <button className="rounded-full bg-apple-red px-5 py-2.5 text-sm font-semibold text-white" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
