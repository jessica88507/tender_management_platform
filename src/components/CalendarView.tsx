"use client";

import { Fragment, useState } from "react";
import { MapPin, Plus, Star, Warning } from "@phosphor-icons/react";
import { Case, Task } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { CATEGORIES, catColor, catIconComponent, catLetter } from "@/lib/constants";
import { addDays, toISO, uid } from "@/lib/date";
import { AddEventModal } from "./AddEventModal";

export function CalendarView({ caseId, c }: { caseId: string; c: Case }) {
  const { updateCase } = useApp();
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const MAX_VISIBLE_TASKS = 3;

  const toggleExpand = (iso: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const workStart = new Date(c.workStart + "T00:00:00");
  const tenderStart = new Date(c.start + "T00:00:00");
  const deadlineDT = new Date(c.deadline);
  const deadline = new Date(deadlineDT.getFullYear(), deadlineDT.getMonth(), deadlineDT.getDate());
  const rangeStart = workStart < tenderStart ? workStart : tenderStart;
  const rangeEnd = addDays(deadline, 30);

  const cursorStart = new Date(rangeStart);
  cursorStart.setDate(cursorStart.getDate() - cursorStart.getDay());
  const lastDay = new Date(rangeEnd);
  lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const tasksByDate: Record<string, Task[]> = {};
  c.tasks.forEach((t) => {
    (tasksByDate[t.due] = tasksByDate[t.due] || []).push(t);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISO(today);
  const soon = addDays(today, 2);
  const alertDates = new Set<string>();
  c.tasks.forEach((t) => {
    if (t.done) return;
    const due = new Date(t.due + "T00:00:00");
    if (due <= soon) alertDates.add(t.due);
  });

  const weeks: { weekKey: string; monthLabel: string | null; days: Date[] }[] = [];
  const cursor = new Date(cursorStart);
  let prevMonth: string | null = null;
  while (cursor <= lastDay) {
    const weekMidpoint = new Date(cursor);
    weekMidpoint.setDate(weekMidpoint.getDate() + 3);
    const monthLabel = `${weekMidpoint.getMonth() + 1}月`;
    const showMonth = monthLabel !== prevMonth;
    if (showMonth) prevMonth = monthLabel;
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    weeks.push({ weekKey: toISO(cursor), monthLabel: showMonth ? monthLabel : null, days });
    cursor.setDate(cursor.getDate() + 7);
  }

  const moveTask = (taskId: string, dateISO: string) => {
    updateCase(caseId, (draft) => {
      const task = draft.tasks.find((t) => t.id === taskId);
      if (task && task.due !== dateISO) task.due = dateISO;
    });
  };

  const setWeekNote = (weekKey: string, value: string) => {
    updateCase(caseId, (draft) => {
      draft.weekNotes[weekKey] = value;
    });
  };

  const createEvent = (dateISO: string, cat: string, label: string) => {
    updateCase(caseId, (draft) => {
      draft.tasks.push({ id: uid(), cat, label, owner: draft.bidLead || "", due: dateISO, done: false, milestone: null });
    });
    setAddingDate(null);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3.5 text-[12.5px] text-ink-soft">
        {CATEGORIES.map((cat) => {
          const CatIcon = catIconComponent(cat);
          return (
            <span key={cat} className="inline-flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: catColor(cat) }} />
              {catLetter(cat)}・<CatIcon size={13} />
              {cat}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <Star weight="fill" size={13} className="text-accent-gold" />
          大事記項目
        </span>
      </div>

      <table className="w-full border-collapse text-[11px] mb-1.5">
        <tbody>
          {weeks.map((week) => (
            <Fragment key={week.weekKey}>
              {week.monthLabel && (
                <>
                  <tr>
                    <td colSpan={8} className="bg-[#F2D9B8] font-serif font-bold text-[13px] text-center py-1.5 tracking-[0.15em] border border-line-grey">
                      {week.monthLabel}
                    </td>
                  </tr>
                  <tr>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "本週目標／備注"].map((label) => (
                      <th key={label} className="bg-[#DCE6EC] text-[11px] py-1.5 px-0.5 font-bold text-ink-soft border border-line-grey">
                        {label}
                      </th>
                    ))}
                  </tr>
                </>
              )}
              <tr>
                {week.days.map((d, i) => {
                  const iso = toISO(d);
                  const inRange = d >= rangeStart && d <= deadline;
                  const dayTasks = (tasksByDate[iso] || []).slice().sort((a, b) => (b.milestone ? 1 : 0) - (a.milestone ? 1 : 0));
                  const isToday = iso === todayISO;
                  const hasAlert = alertDates.has(iso);
                  const isExpanded = expandedDays.has(iso);
                  const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE_TASKS);
                  const hiddenCount = dayTasks.length - visibleTasks.length;
                  const isWeekend = i === 0 || i === 6;
                  return (
                    <td
                      key={iso}
                      className={
                        "w-[12.5%] min-h-[72px] max-h-[168px] overflow-y-auto p-1 px-1.5 relative bg-paper-light transition-colors border border-line-grey align-top " +
                        (!inRange ? "bg-[#E7E0D0] " : "") +
                        (isToday ? "!bg-[#DCEBE3] shadow-[inset_0_0_0_3px_var(--color-done-green)] " : "") +
                        (hasAlert && isToday
                          ? "animate-[calAlertPulseToday_1.4s_ease-in-out_infinite] "
                          : hasAlert
                          ? "animate-[calAlertPulse_1.4s_ease-in-out_infinite] "
                          : "") +
                        (dragOverDate === iso ? "!bg-[#F5E6C8] outline-2 outline-dashed outline-chop-red -outline-offset-2 " : "")
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverDate(iso);
                      }}
                      onDragLeave={() => setDragOverDate((prev) => (prev === iso ? null : prev))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverDate(null);
                        const taskId = e.dataTransfer.getData("text/plain");
                        if (taskId) moveTask(taskId, iso);
                      }}
                    >
                      <div
                        className={
                          "font-mono text-[10.5px] font-semibold mb-1 flex justify-between items-center " +
                          (isWeekend ? "text-weekend-red " : "text-ink-soft ") +
                          (isToday ? "!text-done-green font-extrabold" : "")
                        }
                      >
                        <span className="flex items-center gap-0.5">
                          {isToday && <MapPin weight="fill" size={11} />}
                          {d.getMonth() + 1}/{d.getDate()}
                          {isToday ? " 今天" : ""}
                        </span>
                        <button
                          title="新增事件"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingDate(iso);
                          }}
                          className="border border-line-grey rounded text-tab-brown opacity-50 hover:opacity-100 hover:bg-tab-brown hover:text-white cursor-pointer leading-none px-0.5"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      {hasAlert && (
                        <div className="text-[9px] text-chop-red font-bold mb-0.5 flex items-center gap-0.5">
                          <Warning weight="fill" size={9} />
                          待處理
                        </div>
                      )}
                      {visibleTasks.map((t) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(t.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          title={t.owner || ""}
                          style={{ ["--cat-color" as string]: catColor(t.cat) }}
                          className={
                            "text-[11.5px] leading-[1.4] py-0.5 px-1.5 mb-0.5 rounded bg-black/5 border-l-[3px] [border-left-color:var(--cat-color)] cursor-grab flex items-center gap-1 " +
                            (t.done ? "opacity-45 line-through " : "") +
                            (t.milestone ? "!bg-[#F6E3B4] !border-l-chop-red font-bold shadow-[0_0_0_1px_inset_var(--color-accent-gold)] " : "") +
                            (draggingId === t.id ? "opacity-25 " : "")
                          }
                        >
                          {t.milestone && <Star weight="fill" size={10} className="shrink-0 text-chop-red" />}
                          {t.label}
                        </div>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(iso);
                          }}
                          className="block w-full text-center bg-transparent border border-dashed border-line-grey rounded text-tab-brown text-[10px] py-0 px-1 cursor-pointer mt-0.5 hover:bg-tab-brown/10 hover:border-tab-brown"
                        >
                          +{hiddenCount} 展開
                        </button>
                      )}
                      {isExpanded && dayTasks.length > MAX_VISIBLE_TASKS && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(iso);
                          }}
                          className="block w-full text-center bg-transparent border border-dashed border-line-grey rounded text-tab-brown text-[10px] py-0 px-1 cursor-pointer mt-0.5 hover:bg-tab-brown/10 hover:border-tab-brown"
                        >
                          收合
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="w-[13%] bg-[#FBF8F1] border border-line-grey align-top">
                  <textarea
                    value={c.weekNotes[week.weekKey] || ""}
                    onChange={(e) => setWeekNote(week.weekKey, e.target.value)}
                    className="w-full h-full min-h-[72px] border-none bg-transparent text-[11px] resize-none p-1 text-ink-soft focus:outline-none focus:[outline:1px_dashed_var(--color-accent-gold)]"
                  />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      <div className="text-xs text-ink-soft mt-2.5 font-mono">
        提示：點日期格右上角「＋」可直接新增事件；拖曳事件卡片到其他日期即可改期，會自動同步回清單檢視／整體進度上的大事記標記。勾選完成或編輯負責人請切換到清單檢視。淺色網底的日期表示已超出目前的內部開案～截止範圍（投標截止後仍保留1個月供評選作業使用）。
      </div>

      {addingDate && (
        <AddEventModal
          dateISO={addingDate}
          onCancel={() => setAddingDate(null)}
          onCreate={(cat, label) => createEvent(addingDate, cat, label)}
        />
      )}
    </div>
  );
}
