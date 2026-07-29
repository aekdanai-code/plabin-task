import { getCategories } from "@/actions/category-actions";
import { CategoryManagement } from "@/components/category-management";
import { requireAdmin } from "@/lib/auth";

export default async function SettingsPage() {
  await requireAdmin();
  const categories = await getCategories();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-apple-muted">Admin</p>
        <h1 className="text-3xl font-semibold text-apple-text">จัดการหมวดหมู่</h1>
      </div>
      <CategoryManagement categories={categories.ok ? categories.data : []} />
    </main>
  );
}
