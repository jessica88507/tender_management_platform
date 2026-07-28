"use client";

import { Fragment, useState } from "react";
import { MapPin, Plus, Star, Warning } from "@phosphor-icons/react";
import { Case, Task } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { CATEGORIES, catColor, catLetter } from "@/lib/constants";
import { catIconComponent } from "@/lib/categoryIcons";
import { addDays, toISO, uid } from "@/lib/date";
import { AddEventModal } from "./AddEventModal";
import { EventDetailModal } from "./EventDetailModal";

export function CalendarView({ caseId, c }: { caseId: string; c: Case }) {
  const { updateCase, canEditActive } = useApp();
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
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
  // Highlighted "active" range runs from 統包啟動會議 (kickoff, 招標公告前7天) through 施工評選簡報日
  // (eval presentation day, 投標截止後14天) — see scheduler.ts's "kickoff"/"eval_presentation_day"
  // rules — so both bookend events actually fall inside the highlighted range, not just the
  // narrower 招標公告～投標截止 window.
  const kickoff = addDays(tenderStart, -7);
  const evalDay = addDays(deadline, 14);
  const rangeStart = [workStart, tenderStart, kickoff].reduce((a, b) => (a < b ? a : b));
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

  const createEvent = (dateISO: string, cat: string, label: string, note: string) => {
    updateCase(caseId, (draft) => {
      draft.tasks.push({ id: uid(), cat, label, note, owner: draft.bidLead || "", due: dateISO, done: false, milestone: null });
    });
    setAddingDate(null);
  };

  const saveEventDetail = (taskId: string, patch: Partial<Task>) => {
    updateCase(caseId, (draft) => {
      const task = draft.tasks.find((x) => x.id === taskId);
      if (task) Object.assign(task, patch);
    });
    setSelectedTask((prev) => (prev && prev.id === taskId ? { ...prev, ...patch } : prev));
  };

  const deleteEvent = (taskId: string) => {
    updateCase(caseId, (draft) => {
      draft.tasks = draft.tasks.filter((x) => x.id !== taskId);
    });
    setSelectedTask(null);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3.5 text-[16px] text-ink-soft">
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
          <Star weight="fill" size={13} className="text-highlight" />
          大事記項目
        </span>
      </div>

      <div className="overflow-x-auto mb-1.5 rounded-lg border border-border shadow-sm">
      <table className="w-full min-w-[880px] border-collapse text-[15.5px]">
        <tbody>
          {weeks.map((week) => (
            <Fragment key={week.weekKey}>
              {week.monthLabel && (
                <>
                  <tr>
                    <td colSpan={8} className="bg-highlight-soft font-serif font-bold text-[22px] text-center py-2.5 tracking-[0.2em] border border-border">
                      {week.monthLabel}
                    </td>
                  </tr>
                  <tr>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "本週目標／備注"].map((label) => (
                      <th key={label} className="bg-muted text-[16px] py-2 px-0.5 font-bold text-ink-soft border border-border">
                        {label}
                      </th>
                    ))}
                  </tr>
                </>
              )}
              <tr>
                {week.days.map((d, i) => {
                  const iso = toISO(d);
                  const inRange = d >= rangeStart && d <= evalDay;
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
                        "w-[12.5%] min-h-[72px] max-h-[168px] overflow-y-auto p-1.5 px-2 relative bg-card transition-colors border border-border align-top " +
                        (!inRange ? "bg-muted " : "") +
                        (isToday ? "!bg-success-soft shadow-[inset_0_0_0_3px_var(--color-done-green)] " : "") +
                        (hasAlert && isToday
                          ? "animate-[calAlertPulseToday_1.4s_ease-in-out_infinite] "
                          : hasAlert
                          ? "animate-[calAlertPulse_1.4s_ease-in-out_infinite] "
                          : "") +
                        (dragOverDate === iso ? "!bg-highlight-soft outline-2 outline-dashed outline-primary -outline-offset-2 " : "")
                      }
                      onDragOver={(e) => {
                        if (!canEditActive) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverDate(iso);
                      }}
                      onDragLeave={() => setDragOverDate((prev) => (prev === iso ? null : prev))}
                      onDrop={(e) => {
                        if (!canEditActive) return;
                        e.preventDefault();
                        setDragOverDate(null);
                        const taskId = e.dataTransfer.getData("text/plain");
                        if (taskId) moveTask(taskId, iso);
                      }}
                    >
                      <div
                        className={
                          "font-mono text-[17.5px] font-bold mb-1 flex justify-between items-center " +
                          (isWeekend ? "text-weekend-red " : "text-ink-soft ") +
                          (isToday ? "!text-done-green font-extrabold" : "")
                        }
                      >
                        <span className="flex items-center gap-0.5">
                          {isToday && <MapPin weight="fill" size={12} />}
                          {d.getMonth() + 1}/{d.getDate()}
                          {isToday ? " 今天" : ""}
                        </span>
                        {canEditActive && (
                          <button
                            title="新增事件"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingDate(iso);
                            }}
                            className="border border-border rounded text-accent opacity-50 hover:opacity-100 hover:bg-accent hover:text-white cursor-pointer leading-none px-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary focus-visible:opacity-100"
                          >
                            <Plus size={10} />
                          </button>
                        )}
                      </div>
                      {hasAlert && (
                        <div className="text-[11.5px] text-primary font-bold mb-0.5 flex items-center gap-0.5">
                          <Warning weight="fill" size={9} />
                          待處理
                        </div>
                      )}
                      {visibleTasks.map((t) => {
                        const milestoneOverdue = !!t.milestone && !t.done && t.due < todayISO;
                        return (
                        <div
                          key={t.id}
                          draggable={canEditActive && !t.linkedTaskId}
                          onDragStart={(e) => {
                            if (!canEditActive || t.linkedTaskId) return;
                            e.dataTransfer.setData("text/plain", t.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(t.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(t);
                          }}
                          title={t.linkedTaskId ? "已連結任務，日期會自動跟隨（無法拖曳）" : t.owner || ""}
                          style={{ ["--cat-color" as string]: catColor(t.cat) }}
                          className={
                            "text-[15.5px] leading-[1.4] py-1 px-1.5 mb-0.5 rounded-md bg-black/5 border-l-[3px] [border-left-color:var(--cat-color)] flex items-center gap-1 cursor-pointer transition-[filter,box-shadow] hover:brightness-95 hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] " +
                            (t.done ? "opacity-45 line-through " : "") +
                            (t.milestone ? "!bg-highlight-soft !border-l-highlight font-bold shadow-[0_0_0_1px_inset_var(--color-highlight)] " : "") +
                            (milestoneOverdue
                              ? "!bg-danger-soft !border-l-danger !border-l-[5px] shadow-none animate-[milestoneOverdueFlash_1s_ease-in-out_infinite] "
                              : "") +
                            (draggingId === t.id ? "opacity-25 " : "")
                          }
                        >
                          {t.milestone && <Star weight="fill" size={10} className={"shrink-0 " + (milestoneOverdue ? "text-danger" : "text-highlight")} />}
                          {t.label}
                        </div>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(iso);
                          }}
                          className="block w-full text-center bg-transparent border border-dashed border-border rounded text-accent text-[13px] py-0 px-1 cursor-pointer mt-0.5 hover:bg-accent/10 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
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
                          className="block w-full text-center bg-transparent border border-dashed border-border rounded text-accent text-[13px] py-0 px-1 cursor-pointer mt-0.5 hover:bg-accent/10 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                        >
                          收合
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="w-[13%] bg-muted border border-border align-top">
                  <textarea
                    value={c.weekNotes[week.weekKey] || ""}
                    disabled={!canEditActive}
                    onChange={(e) => setWeekNote(week.weekKey, e.target.value)}
                    className="w-full h-full min-h-[72px] border-none bg-transparent text-[14.5px] resize-none p-1 text-ink-soft focus:outline-none focus:[outline:1px_dashed_var(--color-highlight)] disabled:cursor-not-allowed"
                  />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>

      <div className="text-[15.5px] text-ink-soft mt-2.5 font-mono">
        提示：點日期格右上角「＋」可直接新增事件；點選事件卡片可檢視詳情；拖曳事件卡片到其他日期即可改期，會自動同步回任務清單／整體進度上的大事記標記。淺色網底的日期表示已超出統包啟動會議～施工評選簡報日的範圍（之後仍保留至投標截止後1個月供評選作業使用）。
      </div>

      {addingDate && (
        <AddEventModal
          dateISO={addingDate}
          onCancel={() => setAddingDate(null)}
          onCreate={(cat, label, note) => createEvent(addingDate, cat, label, note)}
        />
      )}

      {selectedTask && (
        <EventDetailModal
          task={selectedTask}
          canEdit={canEditActive}
          onClose={() => setSelectedTask(null)}
          onSave={(patch) => saveEventDetail(selectedTask.id, patch)}
          onDelete={() => deleteEvent(selectedTask.id)}
        />
      )}
    </div>
  );
}
