"use client";

import { useEffect, useState } from "react";
import { ArrowCounterClockwise, FloppyDisk, Info } from "@phosphor-icons/react";
import { useConfirm } from "@/context/ConfirmContext";
import { CATEGORIES } from "@/lib/constants";
import { DEFAULT_TASK_TEMPLATES, TaskTemplateAnchor, TaskTemplateRow } from "@/lib/taskTemplates";

const inputClass =
  "border border-border rounded py-1 px-1.5 text-[16px] bg-card text-ink focus:outline-none focus:border-accent";
const ANCHOR_LABELS: Record<TaskTemplateAnchor, string> = {
  start: "招標公告",
  workStart: "開始作業期程",
  deadline: "投標截止",
};
// meeting_recurring produces a variable number of task instances, so it has no single well-defined
// date to anchor other rules to — excluded from the "其他任務" picker. (標前會 used to be excluded
// here too, back when it could produce up to 3 meetings; it's now always exactly one, so
// eng_signoff anchors to it by default like any other fixed row.)
const NOT_ANCHORABLE = new Set(["meeting_recurring"]);

export function TaskTemplatesPanel() {
  const { customConfirm, customAlert } = useConfirm();
  const [templates, setTemplates] = useState<TaskTemplateRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = () => {
    fetch("/api/task-templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates ?? []);
        setDirty(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (key: string, changes: Partial<TaskTemplateRow>) => {
    setTemplates((prev) => prev?.map((t) => (t.key === key ? { ...t, ...changes } : t)) ?? prev);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!templates) return;
    setSaving(true);
    try {
      const res = await fetch("/api/task-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      const data = await res.json();
      if (!res.ok) {
        await customAlert(data.error || "儲存失敗");
        return;
      }
      setDirty(false);
      await customAlert("已儲存，新建立或重新產生排程的案件將套用最新規則。");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await customConfirm("確定要將所有預設排程規則還原為系統出廠設定嗎？尚未儲存的變更將會遺失。");
    if (!ok) return;
    setTemplates(DEFAULT_TASK_TEMPLATES.map((t) => ({ ...t })));
    setDirty(true);
  };

  if (templates === null) {
    return <div className="text-ink-soft text-[18px]">載入中…</div>;
  }

  return (
    <div>
      <h2 className="font-serif text-[31px] font-bold mb-2">預設排程規則</h2>
      <div className="flex items-start gap-2 bg-highlight-soft border border-highlight rounded-lg py-2.5 px-3.5 text-ink text-[16px] mb-5 max-w-[900px]">
        <Info weight="fill" size={16} className="shrink-0 mt-0.5 text-highlight" />
        <span>
          這裡調整的是「新建立案件」與「依目前設定調整排程」時套用的預設規則。標示為特殊規則的項目（如標前會場次、送件投標的時間判斷）計算邏輯已內建，僅能調整分類／名稱／負責人／是否啟用；一般規則可直接調整天數或百分比。「排程規則」的第一個下拉選單除了招標公告／開始作業期程／投標截止，也可以選擇「其他任務」讓這筆規則跟著另一筆任務的日期走（父子關係），例如「服務建議書用印」跟著「服務建議書送印」前1天。
        </span>
      </div>

      <div className="flex items-center gap-2.5 mb-4">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 bg-ink text-card border-none py-2 px-3.5 rounded-md text-[17px] font-bold cursor-pointer hover:bg-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <FloppyDisk weight="bold" size={15} />
          儲存變更
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 bg-transparent border-[1.5px] border-border text-ink-soft py-2 px-3.5 rounded-md text-[17px] font-bold cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowCounterClockwise weight="bold" size={15} />
          還原系統預設值
        </button>
        {dirty && <span className="text-[15px] text-accent font-mono">尚有未儲存的變更</span>}
      </div>

      {CATEGORIES.map((cat) => {
        const rows = templates.filter((t) => t.category === cat).sort((a, b) => a.sortIndex - b.sortIndex);
        if (rows.length === 0) return null;
        return (
          <div key={cat} className="mb-7">
            <div className="font-mono text-[14.5px] font-bold text-accent tracking-[0.2em] mb-2 uppercase">{cat}</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[16px]">
                <thead>
                  <tr>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2 w-14">啟用</th>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">任務名稱</th>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2 w-32">負責人（預設）</th>
                    <th className="text-left font-mono text-[13.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2 w-[340px]">排程規則</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const anchorTaskOptions = templates.filter(
                      (o) => o.key !== t.key && !NOT_ANCHORABLE.has(o.key)
                    );
                    return (
                    <tr key={t.key} className={t.enabled === false ? "opacity-50" : ""}>
                      <td className="border-b border-dashed border-border py-1.5 px-2">
                        <input
                          type="checkbox"
                          checked={t.enabled !== false}
                          onChange={(e) => patch(t.key, { enabled: e.target.checked })}
                          className="w-4 h-4 cursor-pointer accent-accent"
                        />
                      </td>
                      <td className="border-b border-dashed border-border py-1.5 px-2">
                        <input
                          className={inputClass + " w-full"}
                          value={t.label}
                          onChange={(e) => patch(t.key, { label: e.target.value })}
                        />
                      </td>
                      <td className="border-b border-dashed border-border py-1.5 px-2">
                        <input
                          className={inputClass + " w-full"}
                          value={t.owner}
                          onChange={(e) => patch(t.key, { owner: e.target.value })}
                          placeholder="（預設同主投標手）"
                        />
                      </td>
                      <td className="border-b border-dashed border-border py-1.5 px-2">
                        {t.kind === "fixed" && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <select
                              className={inputClass}
                              value={t.anchorTaskKey ? `task:${t.anchorTaskKey}` : t.anchor ?? "start"}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v.startsWith("task:")) {
                                  patch(t.key, { anchorTaskKey: v.slice(5), anchor: undefined });
                                } else {
                                  patch(t.key, { anchor: v as TaskTemplateAnchor, anchorTaskKey: null });
                                }
                              }}
                            >
                              {(Object.keys(ANCHOR_LABELS) as TaskTemplateAnchor[]).map((a) => (
                                <option key={a} value={a}>
                                  {ANCHOR_LABELS[a]}
                                </option>
                              ))}
                              <optgroup label="其他任務（父子關係）">
                                {anchorTaskOptions.map((o) => (
                                  <option key={o.key} value={`task:${o.key}`}>
                                    {o.label}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <span className="text-ink-soft">後</span>
                            <input
                              type="number"
                              className={inputClass + " w-16"}
                              value={t.offsetDays ?? 0}
                              onChange={(e) => patch(t.key, { offsetDays: Number(e.target.value) })}
                            />
                            <span className="text-ink-soft">天</span>
                          </div>
                        )}
                        {t.kind === "ratio" && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-ink-soft">投標截止前工期</span>
                            <input
                              type="number"
                              className={inputClass + " w-16"}
                              value={t.ratioPct ?? 0}
                              onChange={(e) => patch(t.key, { ratioPct: Number(e.target.value) })}
                            />
                            <span className="text-ink-soft">%</span>
                          </div>
                        )}
                        {t.kind === "special" && <span className="text-ink-soft text-[14.5px]">{t.note || "特殊規則（內建邏輯）"}</span>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
