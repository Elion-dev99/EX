"use client";

import { useState } from "react";
import { ShiftBoard } from "@/components/ShiftBoard";
import { ShopShiftBoard } from "@/components/ShopShiftBoard";
import type { Member } from "@/lib/types";

type Tab = "exec" | "shop";

type Props = {
  initialMembers: Member[];
  shopId?: number;
};

export function AppShell({ initialMembers, shopId = 4 }: Props) {
  const [tab, setTab] = useState<Tab>("exec");

  return (
    <div className="app-shell">
      <nav className="tab-nav" aria-label="表示切替">
        <button
          type="button"
          className={tab === "exec" ? "tab active" : "tab"}
          onClick={() => setTab("exec")}
        >
          幹部
        </button>
        <button
          type="button"
          className={tab === "shop" ? "tab active" : "tab"}
          onClick={() => setTab("shop")}
        >
          大阪店 全員
        </button>
      </nav>

      {tab === "exec" ? (
        <ShiftBoard initialMembers={initialMembers} />
      ) : (
        <ShopShiftBoard shopId={shopId} />
      )}
    </div>
  );
}
