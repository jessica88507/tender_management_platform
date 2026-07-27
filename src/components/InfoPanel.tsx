"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, CaretRight, ClipboardText, FileArrowUp, Lightbulb, PencilSimple, Check } from "@phosphor-icons/react";
import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { useConfirm } from "@/context/ConfirmContext";
import { WEEKDAY_NAMES } from "@/lib/constants";
import { generateTasks } from "@/lib/scheduler";

type Member = { id: string; name: string | null };

const inputClass =
  "w-full py-1.5 px-2 border border-border rounded text-[17.5px] bg-card focus:outline-none focus:border-accent";
const labelClass = "block text-[16px] text-ink-soft font-mono mb-1 tracking-wide";
const btnMiniClass =
  "inline-flex items-center gap-1.5 bg-transparent border-[1.5px] border-accent text-accent py-2 px-3.5 rounded-md text-[18px] font-bold cursor-pointer hover:bg-accent/10 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function InfoPanel({ caseId, c, totalDays }: { caseId: string; c: Case; totalDays: number }) {
  const { ui, setInfoOpen, setInfoEditing, updateCase, canEditActive } = useApp();
  const { customConfirm, customAlert } = useConfirm();
  const [tenderFiles, setTenderFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []))
      .catch(() => {});
  }, []);

  const setField = <K extends keyof Case>(field: K, value: Case[K]) => {
    updateCase(caseId, (draft) => {
      (draft[field] as Case[K]) = value;
    });
  };

  const handleReassignBidLead = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    updateCase(caseId, (draft) => {
      draft.bidLeadUserId = userId;
      if (member?.name) draft.bidLead = member.name;
    });
  };

  const handleExtract = async () => {
    if (!tenderFiles.length) return;
    setExtracting(true);
    try {
      const formData = new FormData();
      tenderFiles.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/extract-tender", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        await customAlert(data.error || "判讀失敗，請稍後再試。");
        return;
      }
      const fields = data.fields ?? {};
      updateCase(caseId, (draft) => {
        if (typeof fields.contractAmount === "number") draft.contractAmount = fields.contractAmount;
        if (typeof fields.siteArea === "number") draft.siteArea = fields.siteArea;
        if (typeof fields.floorArea === "number") draft.floorArea = fields.floorArea;
        if (typeof fields.floorCount === "string" && fields.floorCount) draft.floorCount = fields.floorCount;
        if (typeof fields.tenderStart === "string" && fields.tenderStart) draft.start = fields.tenderStart;
        if (typeof fields.deadline === "string" && fields.deadline) draft.deadline = fields.deadline;
      });
      setTenderFiles([]);
      await customAlert("已自動帶入判讀結果，請確認欄位內容正確無誤後再儲存。");
    } catch (err) {
      console.error(err);
      await customAlert("判讀失敗，請稍後再試。");
    } finally {
      setExtracting(false);
    }
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
      className="group border border-border rounded-lg mb-3.5 bg-card shadow-sm"
      open={ui.infoOpen}
      onToggle={(e) => setInfoOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer py-3 px-4 font-bold text-[22px] font-serif list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
        <CaretRight weight="bold" size={12} className="text-accent group-open:rotate-90 transition-transform" />
        <ClipboardText weight="fill" size={18} className="text-primary" />
        案件資訊（領標、投標截止、契約金額等）
      </summary>
      <div className="px-4 pb-4 pt-1">
        {canEditActive && (
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
        )}

        {(!ui.infoEditing || !canEditActive) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2.5">
            {viewFields.map(([label, value]) => (
              <div key={label}>
                <label className={labelClass}>{label}</label>
                <div className="text-[21px] font-mono text-ink py-1 px-0.5 font-semibold">{value}</div>
              </div>
            ))}
          </div>
        )}

        {ui.infoEditing && canEditActive && (
          <>
            <div className="mb-3.5 border border-dashed border-accent rounded-lg p-3 bg-card">
              <div className="text-[15px] text-ink-soft font-mono mb-2 flex items-center gap-1.5">
                <FileArrowUp weight="bold" size={14} className="text-accent" />
                上傳招標文件自動判讀（可多選，PDF／圖片）
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  onChange={(e) => setTenderFiles(Array.from(e.target.files ?? []))}
                  className="text-[15.5px] text-ink-soft file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-[1.5px] file:border-accent file:bg-transparent file:text-accent file:text-[15.5px] file:font-bold file:cursor-pointer"
                />
                <button
                  className={btnMiniClass}
                  disabled={!tenderFiles.length || extracting}
                  onClick={handleExtract}
                  style={{ opacity: !tenderFiles.length || extracting ? 0.5 : 1 }}
                >
                  {extracting ? "判讀中…" : "自動判讀並帶入欄位"}
                </button>
              </div>
              {tenderFiles.length > 0 && (
                <div className="text-[14.5px] text-ink-soft mt-1.5">已選擇 {tenderFiles.length} 個檔案：{tenderFiles.map((f) => f.name).join("、")}</div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2.5">
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
                <select
                  className={inputClass}
                  value={c.bidLeadUserId || ""}
                  title="可改指派給其他系統成員（管理員帳號不可指派）"
                  onChange={(e) => handleReassignBidLead(e.target.value)}
                >
                  {!members.some((m) => m.id === c.bidLeadUserId) && (
                    <option value={c.bidLeadUserId || ""}>{c.bidLead || "—"}</option>
                  )}
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || "—"}
                    </option>
                  ))}
                </select>
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
              <div className="flex items-start gap-2 bg-highlight-soft border border-highlight rounded-lg py-2.5 px-3.5 text-ink text-[16px] w-full">
                <Lightbulb weight="fill" size={16} className="shrink-0 mt-0.5 text-highlight" />
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
