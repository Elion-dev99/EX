"use client";

import { useState } from "react";
import { buildBoyUrl, parseBoyUrl } from "@/lib/members-client";
import type { Member } from "@/lib/types";

type Props = {
  members: Member[];
  onSaved: (members: Member[]) => void;
};

function toUrlMap(list: Member[]): Record<string, string> {
  return Object.fromEntries(
    list.map((m) => [m.id, m.boyId ? buildBoyUrl(m.shopId, m.boyId) : ""]),
  );
}

export function MemberSettings({ members, onSaved }: Props) {
  const [draft, setDraft] = useState(members);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>(() => toUrlMap(members));

  function openSettings() {
    setDraft(members);
    setUrlDrafts(toUrlMap(members));
    setError(null);
    setOpen(true);
  }

  function updateMember(id: string, patch: Partial<Member>) {
    setDraft((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function applyUrl(id: string, value: string) {
    setUrlDrafts((prev) => ({ ...prev, [id]: value }));
    const parsed = parseBoyUrl(value);
    if (!value.trim()) {
      updateMember(id, { boyId: null, enabled: false });
      return;
    }
    if (parsed) {
      updateMember(id, { shopId: parsed.shopId, boyId: parsed.boyId, enabled: true });
      setError(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const member of draft) {
        const url = urlDrafts[member.id]?.trim() ?? "";
        if (url && !parseBoyUrl(url)) {
          throw new Error(`${member.name} のURL形式が不正です`);
        }
      }

      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存に失敗しました");
      onSaved(data.members);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings">
      <button
        type="button"
        className="ghost-btn"
        onClick={() => (open ? setOpen(false) : openSettings())}
      >
        {open ? "設定を閉じる" : "幹部メンバー設定"}
      </button>

      {open && (
        <div className="settings-panel">
          <p className="settings-help">
            プロフィールURL（例: https://www.dgdgdg.com/boy/detail.php?shop_id=4&boy_id=10235）を6人分登録してください。
          </p>
          <div className="settings-list">
            {draft.map((member, index) => (
              <div key={member.id} className="settings-row">
                <div className="settings-head">
                  <span className="swatch" style={{ background: member.color }} />
                  <strong>幹部 {index + 1}</strong>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={member.enabled && Boolean(member.boyId)}
                      onChange={(e) => updateMember(member.id, { enabled: e.target.checked })}
                      disabled={!member.boyId}
                    />
                    表示
                  </label>
                </div>
                <label>
                  表示名
                  <input
                    value={member.name}
                    onChange={(e) => updateMember(member.id, { name: e.target.value })}
                  />
                </label>
                <label>
                  プロフィールURL
                  <input
                    value={urlDrafts[member.id] ?? ""}
                    placeholder="https://www.dgdgdg.com/boy/detail.php?shop_id=4&boy_id=..."
                    onChange={(e) => applyUrl(member.id, e.target.value)}
                  />
                </label>
                <label>
                  カラー
                  <input
                    type="color"
                    value={member.color}
                    onChange={(e) => updateMember(member.id, { color: e.target.value.toUpperCase() })}
                  />
                </label>
              </div>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="settings-actions">
            <button type="button" className="primary-btn" onClick={save} disabled={saving}>
              {saving ? "保存中…" : "保存して再取得"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
