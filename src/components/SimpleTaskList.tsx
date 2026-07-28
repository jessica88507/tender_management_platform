"use client";

import { Case } from "@/lib/types";
import { CATEGORIES, catColor } from "@/lib/constants";
import { catIconComponent } from "@/lib/categoryIcons";
import { isNonCheckableTask } from "@/lib/derived";

function orderCategories(cats: string[], order: string[] | null | undefined): string[] {
  if (!order || order.length === 0) return cats;
  const known = order.filter((cat) => cats.includes(cat));
  const rest = cats.filter((cat) => !known.includes(cat));
  return [...known, ...rest];
}

// Minimal companion list for 兩者檢視 (dual view): category + task name only, nothing else —
// no owner/date/note/checkbox/star/delete, since CalendarView already carries that detail.
export function SimpleTaskList({ c }: { c: Case }) {
  const catsPresent = orderCategories(
    [
      ...CATEGORIES,
      ...Array.from(new Set(c.tasks.map((t) => t.cat))).filter((x) => !(CATEGORIES as readonly string[]).includes(x)),
    ],
    c.categoryOrder
  );

  return (
    <div className="flex flex-col gap-4">
      {catsPresent.map((cat) => {
        const tasks = c.tasks
          .filter((t) => t.cat === cat)
          .filter((t) => !isNonCheckableTask(t))
          .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
        if (tasks.length === 0) return null;
        const CatIcon = catIconComponent(cat);
        return (
          <div key={cat} style={{ ["--cat-color" as string]: catColor(cat) }}>
            <div className="flex items-center gap-1.5 border-b [border-bottom-color:var(--cat-color)] pb-1 mb-1.5">
              <CatIcon weight="bold" size={13} className="[color:var(--cat-color)] shrink-0" />
              <h4 className="text-[14.5px] font-bold [color:var(--cat-color)] m-0 truncate">{cat}</h4>
            </div>
            <ul className="flex flex-col gap-1">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className={
                    "text-[13.5px] leading-snug py-0.5 pl-1.5 border-l-2 [border-left-color:var(--cat-color)] " +
                    (t.done ? "line-through text-ink-soft/60" : "text-ink")
                  }
                >
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
