import { getInitialData } from "@/actions/task-actions";
import { TaskDashboard } from "@/components/task-dashboard";

export default async function HomePage() {
  const initial = await getInitialData({ sort: "updated_desc" });
  if (!initial.ok) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-apple-red">{initial.message}</main>;
  }
  return <TaskDashboard initial={initial.data} />;
}
