import { ProfileSettings } from "@/components/profile-settings";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireUser();
  return <ProfileSettings user={user} />;
}
