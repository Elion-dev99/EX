import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import defaultMembers from "../../data/members.json";
import type { Member } from "./types";

const membersFile = path.join(process.cwd(), "data", "members.json");

const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shopId: z.number().int().positive(),
  boyId: z.number().int().positive().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  enabled: z.boolean(),
});

const membersSchema = z.array(memberSchema).length(6);

export async function readMembers(): Promise<Member[]> {
  try {
    const raw = await fs.readFile(membersFile, "utf8");
    return membersSchema.parse(JSON.parse(raw));
  } catch {
    // Cloudflare Workers など書き込み不可環境ではバンドル済み設定を使う
    return membersSchema.parse(defaultMembers);
  }
}

export async function writeMembers(members: Member[]): Promise<Member[]> {
  const parsed = membersSchema.parse(members);

  try {
    await fs.writeFile(membersFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    return parsed;
  } catch {
    throw new Error(
      "本番(Cloudflare)ではメンバー設定をファイル保存できません。data/members.json を更新して再デプロイしてください。",
    );
  }
}

export function buildBoyUrl(shopId: number, boyId: number): string {
  return `https://www.dgdgdg.com/boy/detail.php?shop_id=${shopId}&boy_id=${boyId}`;
}

export function parseBoyUrl(input: string): { shopId: number; boyId: number } | null {
  try {
    const url = new URL(input.trim());
    if (!url.hostname.endsWith("dgdgdg.com")) return null;
    const shopId = Number(url.searchParams.get("shop_id"));
    const boyId = Number(url.searchParams.get("boy_id"));
    if (!Number.isInteger(shopId) || !Number.isInteger(boyId) || shopId <= 0 || boyId <= 0) {
      return null;
    }
    return { shopId, boyId };
  } catch {
    return null;
  }
}
