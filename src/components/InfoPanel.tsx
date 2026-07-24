"use client";

import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { useConfirm } from "@/context/ConfirmContext";
import { WEEKDAY_NAMES } from "@/lib/constants";
import { generateTasks } from "@/lib/scheduler";

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
      className="panel"
      open={ui.infoOpen}
      onToggle={(e) => setInfoOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>📋 案件資訊（領標、投標截止、契約金額等）</summary>
      <div className="panel-body">
        <div className="panel-toolbar">
          <button
            className="btn-mini"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInfoEditing(!ui.infoEditing);
            }}
          >
            {ui.infoEditing ? "✓ 完成編輯" : "✎ 編輯資訊"}
          </button>
        </div>

        {!ui.infoEditing && (
          <div className="field-grid">
            {viewFields.map(([label, value]) => (
              <div className="fitem" key={label}>
                <label>{label}</label>
                <div className="view-value">{value}</div>
              </div>
            ))}
          </div>
        )}

        {ui.infoEditing && (
          <>
            <div className="field-grid">
              <div className="fitem">
                <label>開始作業期程</label>
                <input
                  type="date"
                  value={c.workStart}
                  onChange={(e) => setField("workStart", e.target.value)}
                />
              </div>
              <div className="fitem">
                <label>招標公告時間</label>
                <input type="date" value={c.start} onChange={(e) => setField("start", e.target.value)} />
              </div>
              <div className="fitem">
                <label>投標截止（日期＋時間）</label>
                <input
                  type="datetime-local"
                  value={c.deadline}
                  onChange={(e) => setField("deadline", e.target.value)}
                />
              </div>
              <div className="fitem">
                <label>備標天數（開案至截止）</label>
                <input disabled value={`${totalDays} 天`} style={{ color: "var(--ink-soft)" }} readOnly />
              </div>
              <div className="fitem">
                <label>主投標手</label>
                <input
                  type="text"
                  value={c.bidLead || ""}
                  placeholder="你的名字"
                  onChange={(e) => setField("bidLead", e.target.value)}
                />
              </div>
              <div className="fitem">
                <label>例行會議固定星期</label>
                <select
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
              <div className="fitem">
                <label>契約金額（元）</label>
                <input
                  type="number"
                  value={c.contractAmount || ""}
                  placeholder="例：8500000000"
                  onChange={(e) => setField("contractAmount", Number(e.target.value))}
                />
              </div>
              <div className="fitem">
                <label>基地面積（m²）</label>
                <input
                  type="number"
                  value={c.siteArea || ""}
                  onChange={(e) => setField("siteArea", Number(e.target.value))}
                />
              </div>
              <div className="fitem">
                <label>總樓地板面積（m²）</label>
                <input
                  type="number"
                  value={c.floorArea || ""}
                  onChange={(e) => setField("floorArea", Number(e.target.value))}
                />
              </div>
              <div className="fitem">
                <label>預計設計樓層</label>
                <input
                  type="text"
                  value={c.floorCount || ""}
                  onChange={(e) => setField("floorCount", e.target.value)}
                />
              </div>
            </div>

            <div className="panel-footer-actions">
              <div className="status-note callout">
                💡
                80億＝8,000,000,000元（契約金額≥80億時標前會排3場，否則排1場）。調整上方欄位不會自動改動既有任務，如需依新設定全部重排，請按下方按鈕（會覆蓋目前所有任務）。
              </div>
              <button className="btn-mini" onClick={handleRegen}>
                🔄 重新依目前設定產生排程（覆蓋所有任務）
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
