import { PlusCircle } from "lucide-react";

export function EmptyState({ title = "ยังไม่มี Task", description = "เริ่มสร้าง Task แรกของทีมได้เลย" }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-apple-line bg-white p-10 text-center">
      <PlusCircle className="h-10 w-10 text-apple-blue" />
      <h2 className="mt-4 text-xl font-semibold text-apple-text">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-apple-muted">{description}</p>
    </div>
  );
}
