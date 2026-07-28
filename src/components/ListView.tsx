"use client";

import { useState } from "react";
import { DotsSixVertical, LinkSimple, Plus, Star, Trash } from "@phosphor-icons/react";
import { Case, Task } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { CATEGORIES, catColor, catLetter } from "@/lib/constants";
import { catIconComponent } from "@/lib/categoryIcons";
import { fmtWeekday, toISO, uid } from "@/lib/date";
import { getOwnerOptions } from "@/lib/scheduler";
import { isNonCheckableTask } from "@/lib/derived";

function TaskRow({ caseId, t, c, index }: { caseId: string; t: Task; c: Case; index: number }) {
  const { updateCase, canEditActive } = useApp();
  const ownerOptions = getOwnerOptions(c);
  if (t.owner && !ownerOptions.includes(t.owner)) ownerOptions.push(t.owner);
  const linkOptions = c.tasks.filter((x) => x.id !== t.id);

  const patchTask = (patch: Partial<Task>) => {
    updateCase(caseId, (draft) => {
      const task = draft.tasks.find((x) => x.id === t.id);
      if (task) Object.assign(task, patch);
    });
  };

  const removeTask = () => {
    updateCase(caseId, (draft) => {
      draft.tasks = draft.tasks.filter((x) => x.id !== t.id);
    });
  };

  return (
    <div
      id={`task-row-${t.id}`}
      className={
        "flex items-center gap-2 py-2 pr-1 pl-2.5 min-w-[1080px] border-b border-dashed border-border border-l-[3px] [border-left-color:var(--cat-color)] " +
        (t.done ? "opacity-50 " : "") +
        (t.milestone ? "!border-l-highlight bg-highlight/10" : "")
      }
      style={{ ["--cat-color" as string]: catColor(t.cat) }}
    >
      <span className="w-8 shrink-0 text-right font-mono text-[16px] text-ink-soft">{index}</span>
      <input
        type="checkbox"
        checked={t.done}
        disabled={!canEditActive}
        onChange={(e) => patchTask({ done: e.target.checked })}
        className="w-[22px] h-[22px] shrink-0 accent-done-green cursor-pointer disabled:cursor-not-allowed"
      />
      <button
        type="button"
        title={t.milestone ? "取消大事記" : "設為大事記"}
        disabled={!canEditActive}
        onClick={() => patchTask({ milestone: t.milestone ? null : t.id })}
        className={
          "shrink-0 inline-flex cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed " +
          (t.milestone ? "text-highlight" : "text-border hover:text-highlight")
        }
      >
        <Star weight={t.milestone ? "fill" : "regular"} size={17} />
      </button>
      <input
        type="text"
        value={t.label}
        disabled={!canEditActive}
        onChange={(e) => patchTask({ label: e.target.value })}
        className={
          "flex-[2] min-w-0 text-[21.5px] border-none bg-transparent text-ink py-1 px-1 focus:outline-none focus:[outline:1px_dashed_var(--color-highlight)] rounded-sm disabled:cursor-not-allowed " +
          (t.done ? "line-through text-done-green" : "")
        }
      />
      <input
        type="text"
        value={t.note}
        placeholder="說明"
        disabled={!canEditActive}
        onChange={(e) => patchTask({ note: e.target.value })}
        className="flex-1 min-w-0 text-[18px] border-none bg-transparent text-ink-soft py-1 px-1 focus:outline-none focus:[outline:1px_dashed_var(--color-highlight)] rounded-sm disabled:cursor-not-allowed"
      />
      <select
        value={t.owner}
        disabled={!canEditActive}
        onChange={(e) => patchTask({ owner: e.target.value })}
        className="w-[145px] shrink-0 text-[18px] border border-transparent bg-transparent text-ink-soft py-1 px-1 rounded focus:border-border focus:bg-card focus:outline-none disabled:cursor-not-allowed"
      >
        <option value="">— 未指定</option>
        {ownerOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1 shrink-0" title="連結任務：日期會自動跟隨所選任務">
        <LinkSimple weight="bold" size={13} className={t.linkedTaskId ? "text-accent" : "text-border"} />
        <select
          value={t.linkedTaskId || ""}
          disabled={!canEditActive}
          onChange={(e) => {
            const val = e.target.value;
            patchTask(val ? { linkedTaskId: val, linkOffsetDays: t.linkOffsetDays ?? 0 } : { linkedTaskId: null, linkOffsetDays: null });
          }}
          className="w-[110px] text-[15px] border border-transparent bg-transparent text-ink-soft py-1 px-1 rounded focus:border-border focus:bg-card focus:outline-none disabled:cursor-not-allowed"
        >
          <option value="">— 不連結</option>
          {linkOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {t.linkedTaskId && (
          <>
            <input
              type="number"
              value={t.linkOffsetDays ?? 0}
              disabled={!canEditActive}
              onChange={(e) => patchTask({ linkOffsetDays: Number(e.target.value) })}
              className="w-11 text-[15px] font-mono border border-border rounded py-1 px-1 bg-card text-ink-soft focus:outline-none focus:border-accent disabled:cursor-not-allowed"
            />
            <span className="text-[14px] text-ink-soft">天</span>
          </>
        )}
      </div>
      <span className="font-mono text-[17px] text-ink-soft">{fmtWeekday(t.due)}</span>
      <input
        type="date"
        value={t.due}
        disabled={!canEditActive || !!t.linkedTaskId}
        title={t.linkedTaskId ? "已連結任務，日期會自動跟隨" : undefined}
        onChange={(e) => patchTask({ due: e.target.value })}
        className="font-mono text-[18px] font-semibold border border-transparent bg-transparent text-ink-soft py-1 px-1 rounded w-[172px] shrink-0 focus:border-border focus:bg-card focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      {canEditActive && (
        <button title="刪除" onClick={removeTask} className="text-border hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger shrink-0 py-0.5 px-1.5">
          <Trash size={17} />
        </button>
      )}
    </div>
  );
}

function orderCategories(cats: string[], order: string[] | null | undefined): string[] {
  if (!order || order.length === 0) return cats;
  const known = order.filter((cat) => cats.includes(cat));
  const rest = cats.filter((cat) => !known.includes(cat));
  return [...known, ...rest];
}

export function ListView({ caseId, c }: { caseId: string; c: Case }) {
  const { updateCase, canEditActive } = useApp();
  const [draggedCat, setDraggedCat] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const catsPresent = orderCategories(
    [
      ...CATEGORIES,
      ...Array.from(new Set(c.tasks.map((t) => t.cat))).filter((x) => !(CATEGORIES as readonly string[]).includes(x)),
    ],
    c.categoryOrder
  );

  const addTask = (cat: string) => {
    updateCase(caseId, (draft) => {
      draft.tasks.push({ id: uid(), cat, label: "新任務", note: "", owner: "", due: toISO(new Date()), done: false, milestone: null });
    });
  };

  const reorderCategory = (fromCat: string, toCat: string) => {
    if (fromCat === toCat) return;
    const without = catsPresent.filter((cat) => cat !== fromCat);
    const targetIdx = without.indexOf(toCat);
    const next = [...without.slice(0, targetIdx), fromCat, ...without.slice(targetIdx)];
    updateCase(caseId, (draft) => {
      draft.categoryOrder = next;
    });
  };

  return (
    <div>
      {catsPresent.map((cat) => {
        const tasks = c.tasks
          .filter((t) => t.cat === cat)
          // 招標公告／投標截止 are calendar-only markers, never shown as checkable rows here.
          .filter((t) => !isNonCheckableTask(t))
          .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
        if (tasks.length === 0 && !(CATEGORIES as readonly string[]).includes(cat)) return null;
        const doneInCat = tasks.filter((t) => t.done).length;
        const isKnownCat = (CATEGORIES as readonly string[]).includes(cat);
        const CatIcon = catIconComponent(cat);
        return (
          <div
            className={
              "mb-7 rounded-md transition-colors " +
              (dragOverCat === cat && draggedCat !== cat ? "bg-primary/5 outline-2 outline-dashed outline-primary" : "")
            }
            key={cat}
            style={{ ["--cat-color" as string]: catColor(cat) }}
            draggable={canEditActive}
            onDragStart={() => setDraggedCat(cat)}
            onDragOver={(e) => {
              if (!canEditActive) return;
              e.preventDefault();
              setDragOverCat(cat);
            }}
            onDragLeave={() => setDragOverCat((prev) => (prev === cat ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedCat) reorderCategory(draggedCat, cat);
              setDraggedCat(null);
              setDragOverCat(null);
            }}
            onDragEnd={() => {
              setDraggedCat(null);
              setDragOverCat(null);
            }}
          >
            <div className="flex items-baseline gap-2.5 border-b-2 [border-bottom-color:var(--cat-color)] pb-1.5 mb-2.5">
              {canEditActive && (
                <span className="cursor-grab active:cursor-grabbing text-ink-soft/50 hover:text-ink-soft shrink-0" title="拖曳整個分類調整順序">
                  <DotsSixVertical weight="bold" size={16} />
                </span>
              )}
              {isKnownCat && (
                <span
                  className="font-mono text-[19px] font-bold rounded [color:var(--cat-color)] border-2 [border-color:var(--cat-color)] py-0 px-2"
                >
                  {catLetter(cat)}
                </span>
              )}
              <h3 className="font-serif text-[27.5px] font-bold m-0 [color:var(--cat-color)] flex items-center gap-1.5">
                <CatIcon weight="bold" size={19} />
                {cat}
              </h3>
              <span className="font-mono text-[16px] text-ink-soft">
                {doneInCat}/{tasks.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              {tasks.map((t, idx) => (
                <TaskRow key={t.id} caseId={caseId} t={t} c={c} index={idx + 1} />
              ))}
            </div>
            {canEditActive && (
              <button
                onClick={() => addTask(cat)}
                className="bg-transparent border-none text-accent text-[17.5px] font-bold cursor-pointer py-1.5 px-1 hover:underline flex items-center gap-1"
              >
                <Plus weight="bold" size={13} />
                新增項目
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
