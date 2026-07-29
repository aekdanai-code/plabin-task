"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCategory, deactivateCategory, updateCategory } from "@/actions/category-actions";
import type { Category } from "@/types/app";

export function CategoryManagement({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(categories);
  const [isPending, startTransition] = useTransition();

  function create(formData: FormData) {
    if (isPending) return;
    startTransition(async () => {
      const result = await createCategory({
        category_name: String(formData.get("category_name") ?? ""),
        color: String(formData.get("color") ?? "#007AFF")
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  function save(category: Category) {
    if (isPending) return;
    startTransition(async () => {
      const result = await updateCategory(category.id, { category_name: category.category_name, color: category.color });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  function remove(categoryId: string) {
    if (isPending) return;
    startTransition(async () => {
      const result = await deactivateCategory(categoryId);
      if (result.ok) {
        setRows((current) => current.filter((row) => row.id !== categoryId));
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-5">
      <form action={create} className="grid gap-3 rounded-lg bg-white p-5 shadow-soft sm:grid-cols-[1fr_80px_auto] sm:items-end">
        <label>
          <span className="text-sm font-medium">ชื่อหมวดหมู่</span>
          <input required name="category_name" className="mt-2 w-full rounded-lg border border-apple-line px-4 py-3 text-sm" />
        </label>
        <label>
          <span className="text-sm font-medium">สี</span>
          <input name="color" type="color" defaultValue="#007AFF" className="mt-2 h-11 w-full rounded-lg border border-apple-line bg-white p-1" />
        </label>
        <button disabled={isPending} className="flex items-center justify-center gap-2 rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          <Plus className="h-4 w-4" /> เพิ่ม
        </button>
      </form>

      <section className="divide-y divide-apple-line rounded-lg bg-white px-5 shadow-soft">
        {rows.map((category, index) => (
          <div key={category.id} className="grid gap-3 py-4 sm:grid-cols-[40px_1fr_80px_40px_40px] sm:items-center">
            <span className="text-sm text-apple-muted">{index + 1}</span>
            <input
              value={category.category_name}
              onChange={(event) =>
                setRows((current) => current.map((row) => (row.id === category.id ? { ...row, category_name: event.target.value } : row)))
              }
              className="rounded-lg border border-apple-line px-3 py-2 text-sm"
            />
            <input
              value={category.color}
              type="color"
              onChange={(event) => setRows((current) => current.map((row) => (row.id === category.id ? { ...row, color: event.target.value } : row)))}
              className="h-10 w-full rounded-lg border border-apple-line bg-white p-1"
            />
            <button onClick={() => save(category)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-apple-bg text-apple-blue" title="บันทึก" aria-label="บันทึก">
              <Save className="h-4 w-4" />
            </button>
            <button onClick={() => remove(category.id)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-apple-red/10 text-apple-red" title="ปิดใช้งาน" aria-label="ปิดใช้งาน">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
