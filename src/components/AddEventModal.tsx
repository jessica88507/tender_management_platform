"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";

export function AddEventModal({
  dateISO,
  onCancel,
  onCreate,
}: {
  dateISO: string;
  onCancel: () => void;
  onCreate: (cat: string, label: string, note: string) => void;
}) {
  const [cat, setCat] = useState<string>(CATEGORIES[0]);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");

  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-card border border-border rounded-[10px] py-5 px-5.5 max-w-[380px] shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
        <div className="font-bold text-[19.5px] text-ink mb-2.5">➕ 新增事件（{dateISO}）</div>
        <div className="mb-2.5">
          <label className="block text-[14.5px] text-ink-soft mb-1">分類</label>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="w-full py-1.5 px-2 border border-border rounded-md text-[17px] bg-card"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-2.5">
          <label className="block text-[14.5px] text-ink-soft mb-1">事件名稱</label>
          <input
            type="text"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如：與甲方確認範圍"
            className="w-full py-1.5 px-2 border border-border rounded-md text-[17px] bg-card"
          />
        </div>
        <div className="mb-2.5">
          <label className="block text-[14.5px] text-ink-soft mb-1">說明</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="補充說明（選填）"
            rows={2}
            className="w-full py-1.5 px-2 border border-border rounded-md text-[17px] bg-card resize-none focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="bg-transparent border-[1.5px] border-accent text-accent py-2 px-3.5 rounded-md text-[17px] font-bold cursor-pointer hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            取消
          </button>
          <button
            onClick={() => onCreate(cat, label.trim() || "新增事件", note.trim())}
            className="bg-primary text-white border-none py-3 px-5.5 rounded-lg font-bold cursor-pointer text-[19.5px] hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            新增
          </button>
        </div>
      </div>
    </div>
  );
}
