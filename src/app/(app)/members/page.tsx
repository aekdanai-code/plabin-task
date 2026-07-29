import { getMembers } from "@/actions/member-actions";
import { requireAdmin } from "@/lib/auth";
import { MemberManagement } from "@/components/member-management";

export default async function MembersPage() {
  const currentUser = await requireAdmin();
  const members = await getMembers();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-apple-muted">Admin</p>
        <h1 className="text-3xl font-semibold text-apple-text">จัดการสมาชิก</h1>
      </div>
      <MemberManagement members={members.ok ? members.data : []} currentUserId={currentUser.id} />
    </main>
  );
}
