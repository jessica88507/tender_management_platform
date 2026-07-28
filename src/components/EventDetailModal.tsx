"use client";

import { useState } from "react";
import { Star, Trash } from "@phosphor-icons/react";
import { Task } from "@/lib/types";
import { CATEGORIES } from "@/lib/constants";
import { fmtWeekday } from "@/lib/date";
import { isNonCheckableTask } from "@/lib/derived";
import { useConfirm } from "@/context/ConfirmContext";

const inputClass = "w-full py-1.5 px-2 border border-border rounded-md text-[17px] bg-card focus:outline-none focus:border-accent";

export function EventDetailModal({
  task,
  canEdit,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  canEdit: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const { customConfirm } = useConfirm();
  const [cat, setCat] = useState(task.cat);
  const [label, setLabel] = useState(task.label);
  const [note, setNote] = useState(task.note);
  const [due, setDue] = useState(task.due);
  const [done, setDone] = useState(task.done);

  const dirty =
    cat !== task.cat ||
    label.trim() !== task.label ||
    note.trim() !== task.note ||
    due !== task.due ||
    done !== task.done;

  const handleSave = () => {
    onSave({ cat, label: label.trim() || task.label, note: note.trim(), due, done });
    onClose();
  };

  const handleBackdropClick = async () => {
    if (!canEdit || !dirty) {
      onClose();
      return;
    }
    const discard = await customConfirm("尚有未儲存的變更，確定要放棄並關閉嗎？");
    if (discard) onClose();
  };

  const handleDelete = async () => {
    const ok = await customConfirm(`確定要刪除「${task.label}」這個事件嗎？此操作無法復原。`);
    if (ok) onDelete();
  };

  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-[999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleBackdropClick();
      }}
    >
      <div className="bg-card border border-border rounded-[10px] py-5 px-5.5 max-w-[420px] w-[90vw] shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
        <div className="font-bold text-[19.5px] text-ink flex items-center gap-1.5 mb-3.5">
          {task.milestone && <Star weight="fill" size={14} className="text-highlight" />}
          事件詳情
        </div>

        {canEdit ? (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[14.5px] text-ink-soft mb-1">事件名稱</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[14.5px] text-ink-soft mb-1">說明</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputClass + " resize-none"}
              />
            </div>
            <div>
              <label className="block text-[14.5px] text-ink-soft mb-1">時間{task.linkedTaskId ? "（已連結任務，自動跟隨）" : ""}</label>
              <input
                type="date"
                value={due}
                disabled={!!task.linkedTaskId}
                onChange={(e) => setDue(e.target.value)}
                className={inputClass + " disabled:opacity-60 disabled:cursor-not-allowed"}
              />
            </div>
            {!isNonCheckableTask(task) && (
              <div>
                <label className="block text-[14.5px] text-ink-soft mb-1">狀態</label>
                <label className="flex items-center gap-2 text-[17px] text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={(e) => setDone(e.target.checked)}
                    className="w-4 h-4 accent-done-green cursor-pointer"
                  />
                  已完成
                </label>
              </div>
            )}
            <div>
              <label className="block text-[14.5px] text-ink-soft mb-1">分類</label>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className={inputClass}>
                {[...new Set([cat, ...CATEGORIES])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-[14.5px] text-ink-soft font-mono mb-0.5">事件名稱</div>
              <div className={"text-[19.5px] text-ink font-bold " + (task.done ? "line-through text-done-green" : "")}>
                {task.label}
              </div>
            </div>
            <div>
              <div className="text-[14.5px] text-ink-soft font-mono mb-0.5">說明</div>
              <div className="text-[17px] text-ink whitespace-pre-wrap">{task.note || "（無說明）"}</div>
            </div>
            <div>
              <div className="text-[14.5px] text-ink-soft font-mono mb-0.5">時間</div>
              <div className="text-[17px] font-mono text-ink">{fmtWeekday(task.due)}</div>
            </div>
            {!isNonCheckableTask(task) && (
              <div>
                <div className="text-[14.5px] text-ink-soft font-mono mb-0.5">狀態</div>
                <span
                  className={
                    "inline-block text-[15.5px] font-bold rounded-full py-0.5 px-2.5 " +
                    (task.done ? "bg-done-green/15 text-done-green" : "bg-highlight/15 text-accent")
                  }
                >
                  {task.done ? "已完成" : "待處理"}
                </span>
              </div>
            )}
            <div>
              <div className="text-[14.5px] text-ink-soft font-mono mb-0.5">分類</div>
              <div className="text-[17px] text-ink">{task.cat}</div>
            </div>
          </div>
        )}

        <div className={"flex items-center mt-4 " + (canEdit ? "justify-between" : "justify-end")}>
          {canEdit && (
            <button
              onClick={handleDelete}
              title="刪除事件"
              className="flex items-center gap-1.5 bg-transparent border-[1.5px] border-danger text-danger py-2 px-3 rounded-md text-[17px] font-bold cursor-pointer hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              <Trash weight="bold" size={15} />
              刪除
            </button>
          )}
          <div className="flex gap-2">
            {canEdit && (
              <button
                onClick={onClose}
                className="bg-transparent border-[1.5px] border-border text-ink-soft py-2 px-3.5 rounded-md text-[17px] font-bold cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                取消
              </button>
            )}
            <button
              onClick={canEdit ? handleSave : onClose}
              className="bg-primary border-none text-white py-2 px-3.5 rounded-md text-[17px] font-bold cursor-pointer hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {canEdit ? "儲存" : "關閉"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
