"use client";

import { Fragment, useState } from "react";
import { Case, Task } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { CATEGORIES, catColor, catIcon, catLetter } from "@/lib/constants";
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
      <div className="cal-legend">
        {CATEGORIES.map((cat) => (
          <span key={cat}>
            <i style={{ background: catColor(cat) }} />
            {catLetter(cat)}・{catIcon(cat)} {cat}
          </span>
        ))}
        <span>
          <i style={{ background: "var(--accent-gold)" }} />★ 大事記項目
        </span>
      </div>

      <table className="cal-table">
        <tbody>
          {weeks.map((week) => (
            <Fragment key={week.weekKey}>
              {week.monthLabel && (
                <>
                  <tr className="cal-month-row">
                    <td colSpan={8}>{week.monthLabel}</td>
                  </tr>
                  <tr className="cal-head-row">
                    <th>Sun</th>
                    <th>Mon</th>
                    <th>Tue</th>
                    <th>Wed</th>
                    <th>Thu</th>
                    <th>Fri</th>
                    <th>Sat</th>
                    <th>本週目標／備注</th>
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
                  return (
                    <td
                      key={iso}
                      className={
                        "cal-day " +
                        (i === 0 || i === 6 ? "weekend " : "") +
                        (!inRange ? "other-range " : "") +
                        (isToday ? "is-today " : "") +
                        (hasAlert ? "cal-day-alert " : "") +
                        (dragOverDate === iso ? "drag-over " : "")
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
                      <div className="cal-date">
                        {isToday ? "📍 " : ""}
                        {d.getMonth() + 1}/{d.getDate()}
                        {isToday ? " 今天" : ""}
                        <button
                          className="cal-add-btn"
                          title="新增事件"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingDate(iso);
                          }}
                        >
                          ＋
                        </button>
                      </div>
                      {hasAlert && <div className="cal-alert-tag">⚠️ 待處理</div>}
                      {visibleTasks.map((t) => (
                        <div
                          key={t.id}
                          className={
                            "cal-task " + (t.done ? "done " : "") + (t.milestone ? "milestone " : "") + (draggingId === t.id ? "dragging " : "")
                          }
                          style={{ ["--cat-color" as string]: catColor(t.cat) }}
                          title={t.owner || ""}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(t.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                        >
                          {t.milestone ? "★ " : ""}
                          {t.label}
                        </div>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          className="cal-more-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(iso);
                          }}
                        >
                          +{hiddenCount} 展開
                        </button>
                      )}
                      {isExpanded && dayTasks.length > MAX_VISIBLE_TASKS && (
                        <button
                          className="cal-more-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(iso);
                          }}
                        >
                          收合
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="cal-note-cell">
                  <textarea
                    value={c.weekNotes[week.weekKey] || ""}
                    onChange={(e) => setWeekNote(week.weekKey, e.target.value)}
                  />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      <div className="status-note">
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
