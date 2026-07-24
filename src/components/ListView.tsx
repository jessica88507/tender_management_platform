"use client";

import { Case, Task } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { CATEGORIES, catColor, catIcon, catLetter } from "@/lib/constants";
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
      className={"task-row" + (t.done ? " done" : "") + (t.milestone ? " milestone" : "")}
      style={{ ["--cat-color" as string]: catColor(t.cat) }}
    >
      <span className="task-index">{index}</span>
      <input
        type="checkbox"
        className="task-check"
        checked={t.done}
        onChange={(e) => patchTask({ done: e.target.checked })}
      />
      {t.milestone && (
        <span className="ms-star" title="大事記項目">
          ★
        </span>
      )}
      <input
        type="text"
        className="task-name"
        value={t.label}
        onChange={(e) => patchTask({ label: e.target.value })}
      />
      <select className="task-owner" value={t.owner} onChange={(e) => patchTask({ owner: e.target.value })}>
        <option value="">— 未指定</option>
        {ownerOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--ink-soft)" }}>
        {fmtWeekday(t.due)}
      </span>
      <input
        type="date"
        className="task-date"
        value={t.due}
        onChange={(e) => patchTask({ due: e.target.value })}
      />
      <button className="task-del" title="刪除" onClick={removeTask}>
        ×
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
        return (
          <div className="category" key={cat} style={{ ["--cat-color" as string]: catColor(cat) }}>
            <div className="category-head">
              {isKnownCat && <span className="cletter">{catLetter(cat)}</span>}
              <h3>
                {catIcon(cat)} {cat}
              </h3>
              <span className="ccount">
                {doneInCat}/{tasks.length}
              </span>
            </div>
            <div>
              {tasks.map((t, idx) => (
                <TaskRow key={t.id} caseId={caseId} t={t} c={c} index={idx + 1} />
              ))}
            </div>
            <button className="add-task-btn" onClick={() => addTask(cat)}>
              ＋ 新增項目
            </button>
          </div>
        );
      })}
    </div>
  );
}
