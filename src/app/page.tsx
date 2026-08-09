import { ShiftBoard } from "@/components/ShiftBoard";
import { readMembers } from "@/lib/members";

export const dynamic = "force-dynamic";

export default async function Home() {
  const members = await readMembers();
  return <ShiftBoard initialMembers={members} />;
}
