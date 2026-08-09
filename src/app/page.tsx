import { AppShell } from "@/components/AppShell";
import { readMembers } from "@/lib/members";

export const dynamic = "force-dynamic";

export default async function Home() {
  const members = await readMembers();
  return <AppShell initialMembers={members} shopId={4} />;
}
