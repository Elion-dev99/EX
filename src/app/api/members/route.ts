import { NextResponse } from "next/server";
import { z } from "zod";
import { clearShiftsCache } from "@/lib/cache";
import { readMembers, writeMembers } from "@/lib/members";

const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shopId: z.number().int().positive(),
  boyId: z.number().int().positive().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  enabled: z.boolean(),
});

const bodySchema = z.object({
  members: z.array(memberSchema).length(6),
});

export async function GET() {
  const members = await readMembers();
  return NextResponse.json({ members });
}

export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const { members } = bodySchema.parse(json);
    const saved = await writeMembers(members);
    clearShiftsCache();
    return NextResponse.json({ members: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
