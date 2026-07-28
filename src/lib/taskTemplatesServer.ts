import { db } from "@/db";
import { taskTemplates } from "@/db/schema";
import { DEFAULT_TASK_TEMPLATES, TaskTemplateRow } from "./taskTemplates";

// Server-only (imports the Drizzle client) — kept out of taskTemplates.ts so that file stays
// safe to import from client components and the pure scheduler engine.

type TaskTemplateDbRow = typeof taskTemplates.$inferSelect;

function rowToTemplate(row: TaskTemplateDbRow): TaskTemplateRow {
  return {
    key: row.key,
    sortIndex: row.sortIndex,
    category: row.category,
    label: row.label,
    owner: row.owner,
    enabled: row.enabled,
    kind: row.kind,
    anchor: row.anchor ?? undefined,
    anchorTaskKey: row.anchorTaskKey ?? undefined,
    offsetDays: row.offsetDays ?? undefined,
    ratioPct: row.ratioPct ?? undefined,
    snap: row.snap,
    milestone: row.milestone,
    note: row.note,
  };
}

function templateToInsertValues(t: TaskTemplateRow) {
  return {
    key: t.key,
    sortIndex: t.sortIndex,
    category: t.category,
    label: t.label,
    owner: t.owner,
    enabled: t.enabled,
    kind: t.kind,
    anchor: t.anchor ?? null,
    anchorTaskKey: t.anchorTaskKey ?? null,
    offsetDays: t.offsetDays ?? null,
    ratioPct: t.ratioPct ?? null,
    snap: t.snap ?? true,
    milestone: t.milestone ?? null,
    note: t.note ?? "",
  };
}

// Returns the live, admin-editable rule set, seeding the table from DEFAULT_TASK_TEMPLATES on
// first use so a fresh DB behaves identically to the hardcoded defaults until an admin edits them.
export async function getTaskTemplateRows(): Promise<TaskTemplateRow[]> {
  const rows = await db.query.taskTemplates.findMany();
  if (rows.length === 0) {
    await db.insert(taskTemplates).values(DEFAULT_TASK_TEMPLATES.map(templateToInsertValues));
    return DEFAULT_TASK_TEMPLATES;
  }
  return rows.map(rowToTemplate).sort((a, b) => a.sortIndex - b.sortIndex);
}

export async function replaceTaskTemplateRows(templates: TaskTemplateRow[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(taskTemplates);
    await tx.insert(taskTemplates).values(templates.map(templateToInsertValues));
  });
}
