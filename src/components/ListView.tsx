"use client";

import { Plus, Star, Trash } from "@phosphor-icons/react";
import { Case, Task } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { CATEGORIES, catColor, catIconComponent, catLetter } from "@/lib/constants";
import { fmtWeekday, toISO, uid } from "@/lib/date";
import { getOwnerOptions } from "@/lib/scheduler";

function TaskRow({ caseId, t, c, index }: { caseId: string; t: Task; c: Case; index: number }) {
  const { updateCase } = useApp();
  const ownerOptions = getOwnerOptions(c);
  if (t.owner && !ownerOptions.includes(t.owner)) ownerOptions.push(t.owner);

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
        "flex items-center gap-2 py-2 pr-1 pl-2.5 border-b border-dashed border-line-grey border-l-[3px] [border-left-color:var(--cat-color)] " +
        (t.done ? "opacity-50 " : "") +
        (t.milestone ? "!border-l-accent-gold bg-accent-gold/10" : "")
      }
      style={{ ["--cat-color" as string]: catColor(t.cat) }}
    >
      <span className="w-5.5 shrink-0 text-right font-mono text-[11.5px] text-ink-soft">{index}</span>
      <input
        type="checkbox"
        checked={t.done}
        onChange={(e) => patchTask({ done: e.target.checked })}
        className="w-[17px] h-[17px] shrink-0 accent-done-green cursor-pointer"
      />
      {t.milestone && (
        <span title="大事記項目" className="shrink-0 inline-flex text-accent-gold">
          <Star weight="fill" size={13} />
        </span>
      )}
      <input
        type="text"
        value={t.label}
        onChange={(e) => patchTask({ label: e.target.value })}
        className={
          "flex-1 min-w-0 text-[15.5px] border-none bg-transparent text-ink py-1 px-1 focus:outline-none focus:[outline:1px_dashed_var(--color-accent-gold)] rounded-sm " +
          (t.done ? "line-through text-done-green" : "")
        }
      />
      <select
        value={t.owner}
        onChange={(e) => patchTask({ owner: e.target.value })}
        className="w-[110px] shrink-0 text-[13px] border border-transparent bg-transparent text-ink-soft py-1 px-1 rounded focus:border-line-grey focus:bg-paper-light focus:outline-none"
      >
        <option value="">— 未指定</option>
        {ownerOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="font-mono text-xs text-ink-soft">{fmtWeekday(t.due)}</span>
      <input
        type="date"
        value={t.due}
        onChange={(e) => patchTask({ due: e.target.value })}
        className="font-mono text-[13px] font-semibold border border-transparent bg-transparent text-ink-soft py-1 px-1 rounded w-[126px] shrink-0 focus:border-line-grey focus:bg-paper-light focus:outline-none"
      />
      <button title="刪除" onClick={removeTask} className="text-line-grey hover:text-danger cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger shrink-0 py-0.5 px-1.5">
        <Trash size={15} />
      </button>
    </div>
  );
}

export function ListView({ caseId, c }: { caseId: string; c: Case }) {
  const { updateCase } = useApp();

  const catsPresent = [
    ...CATEGORIES,
    ...Array.from(new Set(c.tasks.map((t) => t.cat))).filter((x) => !(CATEGORIES as readonly string[]).includes(x)),
  ];

  const addTask = (cat: string) => {
    updateCase(caseId, (draft) => {
      draft.tasks.push({ id: uid(), cat, label: "新任務", owner: "", due: toISO(new Date()), done: false, milestone: null });
    });
  };

  return (
    <div>
      {catsPresent.map((cat) => {
        const tasks = c.tasks
          .filter((t) => t.cat === cat)
          .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
        if (tasks.length === 0 && !(CATEGORIES as readonly string[]).includes(cat)) return null;
        const doneInCat = tasks.filter((t) => t.done).length;
        const isKnownCat = (CATEGORIES as readonly string[]).includes(cat);
        const CatIcon = catIconComponent(cat);
        return (
          <div className="mb-7" key={cat} style={{ ["--cat-color" as string]: catColor(cat) }}>
            <div className="flex items-baseline gap-2.5 border-b-2 [border-bottom-color:var(--cat-color)] pb-1.5 mb-2.5">
              {isKnownCat && (
                <span
                  className="font-mono text-[13.5px] font-bold rounded [color:var(--cat-color)] border-2 [border-color:var(--cat-color)] py-0 px-2"
                >
                  {catLetter(cat)}
                </span>
              )}
              <h3 className="font-serif text-[19px] font-bold m-0 [color:var(--cat-color)] flex items-center gap-1.5">
                <CatIcon weight="bold" size={17} />
                {cat}
              </h3>
              <span className="font-mono text-[11px] text-ink-soft">
                {doneInCat}/{tasks.length}
              </span>
            </div>
            <div>
              {tasks.map((t, idx) => (
                <TaskRow key={t.id} caseId={caseId} t={t} c={c} index={idx + 1} />
              ))}
            </div>
            <button
              onClick={() => addTask(cat)}
              className="bg-transparent border-none text-tab-brown text-xs font-bold cursor-pointer py-1.5 px-1 hover:underline flex items-center gap-1"
            >
              <Plus weight="bold" size={12} />
              新增項目
            </button>
          </div>
        );
      })}
    </div>
  );
}
