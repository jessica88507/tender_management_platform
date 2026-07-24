"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useConfirm } from "@/context/ConfirmContext";
import { toISO } from "@/lib/date";

const inputClass = "w-full py-2 px-2.5 border border-line-grey rounded-md text-[13.5px] bg-white";
const labelClass = "block text-[11px] text-ink-soft mt-2.5 mb-1 font-mono tracking-wide";

export function NewCaseForm({ showEmptyState }: { showEmptyState: boolean }) {
  const { state, createCase } = useApp();
  const { customAlert } = useConfirm();
  const todayStr = toISO(new Date());
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayStr);
  const [deadline, setDeadline] = useState("");

  const handleCreate = async () => {
    if (!deadline) {
      await customAlert("請輸入投標截止日期與時間");
      return;
    }
    createCase({ name: name.trim() || "未命名案件", start: start || todayStr, deadline });
  };

  return (
    <div>
      {showEmptyState && (
        <div className="font-serif text-lg text-ink-soft mt-20">
          {Object.keys(state.cases).length ? "請從左側選擇一個案件" : "目前沒有案件，先新增一個開始排時程吧"}
        </div>
      )}
      <div className="bg-paper-light border border-line-grey rounded-[10px] py-5.5 px-5.5 max-w-[640px] mt-10">
        <h2 className="font-serif text-lg mb-4">新增案件</h2>
        <label className={labelClass}>案件名稱（選填）</label>
        <input
          type="text"
          placeholder="例如：113年○○局資訊設備採購案"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className={labelClass}>開始作業期程</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>投標截止（日期＋時間）</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={handleCreate}
            className="bg-chop-red text-white border-none py-3 px-5.5 rounded-lg font-bold cursor-pointer text-[15px] hover:bg-chop-red-dark"
          >
            建立並依規則自動排程
          </button>
        </div>
        <div className="text-xs text-ink-soft mt-2.5 font-mono">
          建立後系統會依排程原則自動產生：例行會議、吳董設計會議、標前會、公證、服務建議書時程、估算部作業、公司內部簽呈流程等，並標出
          9 項大事記追蹤。招標公告時間、契約金額、基地面積、招標文件上傳、團隊成員等其他資訊，請於開案後在「案件資訊」與「備標團隊成員」區塊填寫（填完契約金額後如需重排標前會場次，按案件資訊裡的重新產生排程即可）。
        </div>
      </div>
    </div>
  );
}
