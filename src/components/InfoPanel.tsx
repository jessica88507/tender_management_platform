"use client";

import { ArrowClockwise, CaretRight, ClipboardText, Lightbulb, PencilSimple, Check } from "@phosphor-icons/react";
import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { useConfirm } from "@/context/ConfirmContext";
import { WEEKDAY_NAMES } from "@/lib/constants";
import { generateTasks } from "@/lib/scheduler";

const inputClass =
  "w-full py-1.5 px-2 border border-line-grey rounded text-[12.5px] bg-white focus:outline-none focus:border-tab-brown";
const labelClass = "block text-[11.5px] text-ink-soft font-mono mb-1 tracking-wide";
const btnMiniClass =
  "inline-flex items-center gap-1.5 bg-transparent border-[1.5px] border-tab-brown text-tab-brown py-2 px-3.5 rounded-md text-[13px] font-bold cursor-pointer hover:bg-tab-brown/10";

export function InfoPanel({ caseId, c, totalDays }: { caseId: string; c: Case; totalDays: number }) {
  const { ui, setInfoOpen, setInfoEditing, updateCase } = useApp();
  const { customConfirm } = useConfirm();

  const setField = <K extends keyof Case>(field: K, value: Case[K]) => {
    updateCase(caseId, (draft) => {
      (draft[field] as Case[K]) = value;
    });
  };

  const viewFields: [string, string][] = [
    ["開始作業期程", c.workStart],
    ["招標公告時間", c.start],
    ["投標截止（日期＋時間）", c.deadline ? c.deadline.replace("T", " ") : "—"],
    ["備標天數（開案至截止）", `${totalDays} 天`],
    ["主投標手", c.bidLead || "—"],
    ["例行會議固定星期", WEEKDAY_NAMES[Number(c.meetingWeekday) || 0]],
    ["契約金額（元）", c.contractAmount ? Number(c.contractAmount).toLocaleString() : "—"],
    ["基地面積（m²）", c.siteArea ? String(c.siteArea) : "—"],
    ["總樓地板面積（m²）", c.floorArea ? String(c.floorArea) : "—"],
    ["預計設計樓層", c.floorCount || "—"],
  ];

  const handleRegen = async () => {
    const ok = await customConfirm(
      "確定要依目前的案件資訊重新產生排程嗎？這會覆蓋目前所有任務（含已完成勾選與手動調整）。"
    );
    if (ok) {
      updateCase(caseId, (draft) => {
        draft.tasks = generateTasks(draft);
      });
    }
  };

  return (
    <details
      className="group border border-line-grey rounded-lg mb-3.5 bg-paper-light"
      open={ui.infoOpen}
      onToggle={(e) => setInfoOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer py-3 px-4 font-bold text-[17px] font-serif list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
        <CaretRight weight="bold" size={12} className="text-tab-brown group-open:rotate-90 transition-transform" />
        <ClipboardText weight="fill" size={18} className="text-chop-red" />
        案件資訊（領標、投標截止、契約金額等）
      </summary>
      <div className="px-4 pb-4 pt-1">
        <div className="flex justify-end mb-2">
          <button
            className={btnMiniClass}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInfoEditing(!ui.infoEditing);
            }}
          >
            {ui.infoEditing ? <Check weight="bold" size={14} /> : <PencilSimple weight="bold" size={14} />}
            {ui.infoEditing ? "完成編輯" : "編輯資訊"}
          </button>
        </div>

        {!ui.infoEditing && (
          <div className="grid grid-cols-4 gap-3 mb-2.5">
            {viewFields.map(([label, value]) => (
              <div key={label}>
                <label className={labelClass}>{label}</label>
                <div className="text-base font-mono text-ink py-1 px-0.5 font-semibold">{value}</div>
              </div>
            ))}
          </div>
        )}

        {ui.infoEditing && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-2.5">
              <div>
                <label className={labelClass}>開始作業期程</label>
                <input
                  type="date"
                  className={inputClass}
                  value={c.workStart}
                  onChange={(e) => setField("workStart", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>招標公告時間</label>
                <input
                  type="date"
                  className={inputClass}
                  value={c.start}
                  onChange={(e) => setField("start", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>投標截止（日期＋時間）</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={c.deadline}
                  onChange={(e) => setField("deadline", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>備標天數（開案至截止）</label>
                <input disabled value={`${totalDays} 天`} className={inputClass + " text-ink-soft"} readOnly />
              </div>
              <div>
                <label className={labelClass}>主投標手</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.bidLead || ""}
                  placeholder="你的名字"
                  onChange={(e) => setField("bidLead", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>例行會議固定星期</label>
                <select
                  className={inputClass}
                  value={Number(c.meetingWeekday)}
                  onChange={(e) => setField("meetingWeekday", Number(e.target.value))}
                >
                  {WEEKDAY_NAMES.map((w, i) => (
                    <option key={i} value={i}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>契約金額（元）</label>
                <input
                  type="number"
                  className={inputClass}
                  value={c.contractAmount || ""}
                  placeholder="例：8500000000"
                  onChange={(e) => setField("contractAmount", Number(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>基地面積（m²）</label>
                <input
                  type="number"
                  className={inputClass}
                  value={c.siteArea || ""}
                  onChange={(e) => setField("siteArea", Number(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>總樓地板面積（m²）</label>
                <input
                  type="number"
                  className={inputClass}
                  value={c.floorArea || ""}
                  onChange={(e) => setField("floorArea", Number(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>預計設計樓層</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.floorCount || ""}
                  onChange={(e) => setField("floorCount", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2.5 mt-3.5">
              <div className="flex items-start gap-2 bg-[#FCEFD9] border border-accent-gold rounded-lg py-2.5 px-3.5 text-ink text-[12.5px] w-full">
                <Lightbulb weight="fill" size={16} className="shrink-0 mt-0.5 text-accent-gold" />
                <span>
                  80億＝8,000,000,000元（契約金額≥80億時標前會排3場，否則排1場）。調整上方欄位不會自動改動既有任務，如需依新設定全部重排，請按下方按鈕（會覆蓋目前所有任務）。
                </span>
              </div>
              <button className={btnMiniClass} onClick={handleRegen}>
                <ArrowClockwise weight="bold" size={14} />
                重新依目前設定產生排程（覆蓋所有任務）
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
