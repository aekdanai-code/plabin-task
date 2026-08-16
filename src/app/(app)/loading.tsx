import { LoaderCircle } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="fixed inset-0 top-[65px] z-20 flex items-center justify-center bg-apple-bg/90 px-4 backdrop-blur-sm" role="status" aria-live="polite" aria-busy="true">
      <div className="flex min-w-56 flex-col items-center rounded-xl border border-apple-line bg-white px-8 py-7 text-center shadow-panel">
        <LoaderCircle className="h-9 w-9 animate-spin text-apple-blue" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold text-apple-text">กำลังโหลดข้อมูล...</p>
        <p className="mt-1 text-xs text-apple-muted">กรุณารอสักครู่</p>
      </div>
    </div>
  );
}
