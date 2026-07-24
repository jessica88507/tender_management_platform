"use client";

import { useState } from "react";
import { CATEGORIES, catIcon } from "@/lib/constants";

export function AddEventModal({
  dateISO,
  onCancel,
  onCreate,
}: {
  dateISO: string;
  onCancel: () => void;
  onCreate: (cat: string, label: string) => void;
}) {
  const [cat, setCat] = useState<string>(CATEGORIES[0]);
  const [label, setLabel] = useState("");

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-box">
        <div className="modal-msg" style={{ marginBottom: 10, fontWeight: 700 }}>
          ➕ 新增事件（{dateISO}）
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>分類</label>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            style={{ width: "100%", padding: 7, border: "1px solid var(--line-grey)", borderRadius: 5 }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {catIcon(c)} {c}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>事件名稱</label>
          <input
            type="text"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如：與甲方確認範圍"
            style={{ width: "100%", padding: 7, border: "1px solid var(--line-grey)", borderRadius: 5 }}
          />
        </div>
        <div className="modal-actions">
          <button className="btn-mini" onClick={onCancel}>
            取消
          </button>
          <button className="btn-primary" onClick={() => onCreate(cat, label.trim() || "新增事件")}>
            新增
          </button>
        </div>
      </div>
    </div>
  );
}
