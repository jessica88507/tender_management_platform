"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, CaretRight, ClipboardText, FileArrowUp, Lightbulb, PencilSimple, Check } from "@phosphor-icons/react";
import { Case, Task } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { useConfirm } from "@/context/ConfirmContext";
import { WEEKDAY_NAMES } from "@/lib/constants";
import { generateTasks } from "@/lib/scheduler";
import type { TaskTemplateRow } from "@/lib/taskTemplates";

type Member = { id: string; name: string | null };

const inputClass =
  "w-full py-1.5 px-2 border border-border rounded text-[17.5px] bg-card focus:outline-none focus:border-accent";
const labelClass = "block text-[16px] text-ink-soft font-mono mb-1 tracking-wide";
const btnMiniClass =
  "inline-flex items-center gap-1.5 bg-transparent border-[1.5px] border-accent text-accent py-2 px-3.5 rounded-md text-[18px] font-bold cursor-pointer hover:bg-accent/10 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const TENDER_TYPE_OPTIONS = ["統包工程", "私人案"];
const CONTRACT_MODE_OPTIONS = ["最有利標", "最低價"];
// 1 坪 = 3.305785 m² — the standard conversion factor used throughout Taiwan real-estate/
// construction industry practice.
const SQM_PER_PING = 3.305785;

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
      let filledCount = 0;
      updateCase(caseId, (draft) => {
        if (typeof fields.contractAmount === "number") { draft.contractAmount = fields.contractAmount; filledCount++; }
        if (typeof fields.siteArea === "number") { draft.siteArea = fields.siteArea; filledCount++; }
        if (typeof fields.floorArea === "number") { draft.floorArea = fields.floorArea; filledCount++; }
        if (typeof fields.floorCount === "string" && fields.floorCount) { draft.floorCount = fields.floorCount; filledCount++; }
        if (typeof fields.tenderStart === "string" && fields.tenderStart) { draft.start = fields.tenderStart; filledCount++; }
        if (typeof fields.deadline === "string" && fields.deadline) { draft.deadline = fields.deadline; filledCount++; }
        if (typeof fields.ownerOrg === "string" && fields.ownerOrg) { draft.ownerOrg = fields.ownerOrg; filledCount++; }
        if (typeof fields.userUnit === "string" && fields.userUnit) { draft.userUnit = fields.userUnit; filledCount++; }
        if (typeof fields.location === "string" && fields.location) { draft.location = fields.location; filledCount++; }
        if (typeof fields.contractMode === "string" && fields.contractMode) { draft.contractMode = fields.contractMode; filledCount++; }
        if (typeof fields.contractScope === "string" && fields.contractScope) { draft.contractScope = fields.contractScope; filledCount++; }
        if (typeof fields.supervisorUnit === "string" && fields.supervisorUnit) { draft.supervisorUnit = fields.supervisorUnit; filledCount++; }
        if (typeof fields.buildingType === "string" && fields.buildingType) { draft.buildingType = fields.buildingType; filledCount++; }
        if (typeof fields.constructionPeriod === "string" && fields.constructionPeriod) { draft.constructionPeriod = fields.constructionPeriod; filledCount++; }
        if (typeof fields.specialNotes === "string" && fields.specialNotes) { draft.specialNotes = fields.specialNotes; filledCount++; }
      });
      setTenderFiles([]);
      // Previously this alert fired unconditionally on any 200 response — even when `fields` came
      // back empty (OCR ran but nothing matched a known label), which silently looked like success
      // while filling in nothing. Report the actual count so a real failure is visible as one.
      if (filledCount === 0) {
        await customAlert("文件已讀取，但沒有辨識出任何欄位，請手動填寫。（此功能對非制式招標公告格式的文件辨識率較低）");
      } else {
        await customAlert(`已自動帶入 ${filledCount} 個欄位的判讀結果，請確認欄位內容正確無誤後再儲存。`);
      }
    } catch (err) {
      console.error(err);
      await customAlert("判讀失敗，請稍後再試。");
    } finally {
      setExtracting(false);
    }
  };

  const floorAreaPing = c.floorArea ? c.floorArea / SQM_PER_PING : 0;
  const costPerPing = c.contractAmount && c.floorArea ? Number(c.contractAmount) / floorAreaPing : 0;
  const formatPing = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const viewFields: [string, string][] = [
    ["業主", c.ownerOrg || "—"],
    ["使用單位", c.userUnit || "—"],
    ["地點", c.location || "—"],
    ["標案形式", c.tenderType || "—"],
    ["契約模式", c.contractMode || "—"],
    ["承攬範圍", c.contractScope || "—"],
    ["監造單位", c.supervisorUnit || "—"],
    ["建築形式", c.buildingType || "—"],
    ["合約工期", c.constructionPeriod || "—"],
    ["開始作業期程", c.workStart],
    ["招標公告時間", c.start],
    ["投標截止（日期＋時間）", c.deadline ? c.deadline.replace("T", " ") : "—"],
    ["備標天數（開案至截止）", `${totalDays} 天`],
    ["主投標手", c.bidLead || "—"],
    ["例行會議固定星期", WEEKDAY_NAMES[Number(c.meetingWeekday) || 0]],
    ["契約金額（元）", c.contractAmount ? Number(c.contractAmount).toLocaleString() : "—"],
    ["基地面積（m²）", c.siteArea ? String(c.siteArea) : "—"],
    ["總樓地板面積（m²）", c.floorArea ? `${c.floorArea}（約 ${formatPing(floorAreaPing)} 坪）` : "—"],
    ["每坪造價（元/坪）", costPerPing ? Math.round(costPerPing).toLocaleString() : "—"],
    ["預計設計樓層", c.floorCount || "—"],
  ];

  const handleRegen = async () => {
    const ok = await customConfirm(
      "確定要依目前的案件資訊調整排程嗎？只會更新與上方欄位相關的日期；已指定的負責人、備註、完成狀態與手動調整過日期的任務都不會被覆蓋。"
    );
    if (!ok) return;

    let templates: TaskTemplateRow[] | undefined;
    try {
      const res = await fetch("/api/task-templates");
      if (res.ok) templates = (await res.json()).templates;
    } catch {
      templates = undefined;
    }

    updateCase(caseId, (draft) => {
      const fresh = generateTasks(draft, templates);
      const oldByKey = new Map(draft.tasks.filter((t) => t.key).map((t) => [t.key as string, t]));
      const freshKeys = new Set(fresh.map((f) => f.key).filter(Boolean));

      const merged: Task[] = fresh.map((f) => {
        const old = f.key ? oldByKey.get(f.key) : undefined;
        if (!old) return f;
        // A task counts as "manually adjusted" once its due date has drifted from what the
        // engine last computed for it — in that case leave the date alone on regenerate.
        const manuallyMoved = old.autoDue != null && old.due !== old.autoDue;
        return {
          ...f,
          id: old.id,
          owner: old.owner,
          note: old.note,
          done: old.done,
          due: manuallyMoved ? old.due : f.due,
          // Preserve any manual 連結任務 link — resolveLinkedTaskDates (run by updateCase right
          // after this) will reconcile `due` against the link target regardless of what value
          // ends up here, so the link surviving the regenerate is what actually matters.
          linkedTaskId: old.linkedTaskId ?? null,
          linkOffsetDays: old.linkOffsetDays ?? null,
        };
      });

      // Tasks whose key no longer appears in the fresh generation (legacy tasks with no key,
      // custom manual additions, or rules an admin has since disabled) are left untouched rather
      // than silently dropped.
      const orphaned = draft.tasks.filter((t) => !t.key || !freshKeys.has(t.key));

      draft.tasks = [...merged, ...orphaned].sort(
        (a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()
      );
    });
  };

  return (
    <details
      className="group border border-border rounded-lg mb-3.5 bg-card shadow-sm"
      open={ui.infoOpen}
      onToggle={(e) => setInfoOpen((e.target as HTMLDetailsElement).open)}
      data-tutorial="info-panel"
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2.5">
              {viewFields.map(([label, value]) => (
                <div key={label}>
                  <label className={labelClass}>{label}</label>
                  <div
                    className={
                      "text-[21px] font-mono py-1 px-0.5 font-semibold " +
                      (value === "—" ? "text-ink-soft font-normal" : "text-accent")
                    }
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {c.specialNotes && (
              <div className="mb-2.5">
                <label className={labelClass}>特殊說明</label>
                <div className="text-[18px] text-ink py-1 px-0.5 whitespace-pre-wrap">{c.specialNotes}</div>
              </div>
            )}
          </>
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
                <label className={labelClass}>業主</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.ownerOrg || ""}
                  placeholder="例：桃園市政府住宅發展處"
                  onChange={(e) => setField("ownerOrg", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>使用單位</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.userUnit || ""}
                  onChange={(e) => setField("userUnit", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>地點</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.location || ""}
                  onChange={(e) => setField("location", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>標案形式</label>
                <select
                  className={inputClass}
                  value={c.tenderType || ""}
                  onChange={(e) => setField("tenderType", e.target.value)}
                >
                  <option value="">—</option>
                  {!TENDER_TYPE_OPTIONS.includes(c.tenderType) && c.tenderType && (
                    <option value={c.tenderType}>{c.tenderType}</option>
                  )}
                  {TENDER_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>契約模式</label>
                <select
                  className={inputClass}
                  value={c.contractMode || ""}
                  onChange={(e) => setField("contractMode", e.target.value)}
                >
                  <option value="">—</option>
                  {!CONTRACT_MODE_OPTIONS.includes(c.contractMode) && c.contractMode && (
                    <option value={c.contractMode}>{c.contractMode}</option>
                  )}
                  {CONTRACT_MODE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>承攬範圍</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.contractScope || ""}
                  placeholder="例：建築+機電工程+設計"
                  onChange={(e) => setField("contractScope", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>監造單位</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.supervisorUnit || ""}
                  onChange={(e) => setField("supervisorUnit", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>建築形式</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.buildingType || ""}
                  placeholder="例：一幢三棟／地下3層地上14層"
                  onChange={(e) => setField("buildingType", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>合約工期</label>
                <input
                  type="text"
                  className={inputClass}
                  value={c.constructionPeriod || ""}
                  placeholder="例：決標後1500日竣工（50個月）"
                  onChange={(e) => setField("constructionPeriod", e.target.value)}
                />
              </div>
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
                {c.floorArea > 0 && (
                  <div className="text-[14.5px] text-ink-soft mt-1">約 {formatPing(floorAreaPing)} 坪</div>
                )}
              </div>
              <div>
                <label className={labelClass}>每坪造價（元/坪）</label>
                <input
                  disabled
                  readOnly
                  value={costPerPing ? Math.round(costPerPing).toLocaleString() : ""}
                  placeholder="需先填契約金額與總樓地板面積"
                  className={inputClass + " text-ink-soft"}
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

            <div className="mb-3.5">
              <label className={labelClass}>特殊說明</label>
              <textarea
                rows={2}
                className={inputClass + " resize-none"}
                value={c.specialNotes || ""}
                placeholder="例：特殊結構審查、綠建築銀級以上、智慧建築合格級以上…"
                onChange={(e) => setField("specialNotes", e.target.value)}
              />
            </div>

            <div className="flex flex-col items-end gap-2.5 mt-3.5">
              <div className="flex items-start gap-2 bg-highlight-soft border border-highlight rounded-lg py-2.5 px-3.5 text-ink text-[16px] w-full">
                <Lightbulb weight="fill" size={16} className="shrink-0 mt-0.5 text-highlight" />
                <span>
                  調整上方欄位不會自動改動既有任務，如需套用新設定，請按下方按鈕（只調整相關日期，不會覆蓋已指派的負責人或手動調整過的任務）。
                </span>
              </div>
              <button className={btnMiniClass} onClick={handleRegen}>
                <ArrowClockwise weight="bold" size={14} />
                依目前設定調整排程（不覆蓋既有指派與手動調整）
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
