import PptxGenJS from "pptxgenjs";
import type { Case } from "./types";
import { CATEGORIES } from "./constants";
import { caseDaysLeft, caseProgress } from "./derived";
import {
  buildAllMonthsCalendars,
  buildMilestoneList,
  overdueTasks,
  type CalendarDay,
  type CalendarMonth,
  type MilestoneStatus,
} from "./reportData";

// Server-side PPTX generation only (this module must never be imported from client components) —
// running PptxGenJS in the browser previously crashed the tab (see docs/MEMORY.md item 4); running
// it inside a Next.js API route (Node.js runtime) sidesteps that entirely.

const COLOR = {
  ink: "241E15",
  inkSoft: "5B5342",
  chopRed: "AE362B",
  tabBrown: "8C6239",
  lineGrey: "B8AF98",
  danger: "A6392E",
  steel: "5E7180",
  navy: "3F5C73",
  sky: "7FA8C9",
  skyPale: "DCE6ED",
  paperLight: "F8F4EA",
  white: "FFFFFF",
  highlight: "B45309",
};

// Same hex values as the web app's light-theme `--color-*` category variables (globals.css) — the
// calendar slide (buildCalendarSlide) mirrors CalendarView's category-color coding exactly, rather
// than reusing this file's own separate chrome palette above, so a task's color means the same
// thing on-screen and in the exported deck.
const CATEGORY_HEX: Record<string, string> = {
  [CATEGORIES[0]]: "1E3A5F", // 會議安排 — navy
  [CATEGORIES[1]]: "65A30D", // 公司內部流程 — olive
  [CATEGORIES[2]]: "BE185D", // 服務建議書製作 — rose
  [CATEGORIES[3]]: "059669", // 投標文件蒐集、確認 — done-green
  [CATEGORIES[4]]: "D97706", // 評選作業 — amber
  [CATEGORIES[5]]: "475569", // 其他事項 — steel
};

// Widely available on Windows (the target platform for this firm) with full CJK glyph coverage —
// safer than the web app's Noto Serif/Sans TC, which most PowerPoint installs won't have embedded.
const FONT = "Microsoft JhengHei";

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  done: "已完成",
  overdue: "已逾期",
  upcoming: "待處理",
};

const MILESTONE_STATUS_COLOR: Record<MilestoneStatus, string> = {
  done: COLOR.navy,
  overdue: COLOR.danger,
  upcoming: COLOR.tabBrown,
};

function fmtDeadline(deadline: string) {
  return deadline.replace("T", " ");
}
function fmtMoney(n: number) {
  return n ? `NT$ ${n.toLocaleString("zh-TW")}` : "—";
}

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN_X = 0.7;
const CONTENT_W = SLIDE_W - MARGIN_X * 2;

function addChrome(slide: PptxGenJS.Slide, caseName: string, index: number, total: number) {
  slide.background = { color: COLOR.white };
  slide.addText(caseName, {
    x: MARGIN_X,
    y: 0.3,
    w: 9,
    h: 0.3,
    fontFace: FONT,
    fontSize: 10,
    bold: true,
    color: COLOR.tabBrown,
    charSpacing: 2,
  });
  slide.addText(`${index} / ${total}`, {
    x: SLIDE_W - MARGIN_X - 1.5,
    y: 0.3,
    w: 1.5,
    h: 0.3,
    fontFace: FONT,
    fontSize: 10,
    color: COLOR.inkSoft,
    align: "right",
  });
}

function addRule(slide: PptxGenJS.Slide, x: number, y: number, w: number) {
  slide.addShape("line" as PptxGenJS.SHAPE_NAME, { x, y, w, h: 0, line: { color: COLOR.ink, width: 1.5 } });
}

// Title + divider rule as one unit: the rule sits below the title's text box (not sharing its
// vertical center), so it never crosses through the glyphs the way a same-row centered line would.
function addSectionTitle(slide: PptxGenJS.Slide, title: string, y: number) {
  slide.addText(title, { x: MARGIN_X, y, w: CONTENT_W, h: 0.45, fontFace: FONT, fontSize: 19, bold: true, color: COLOR.ink });
  addRule(slide, MARGIN_X, y + 0.5, CONTENT_W);
}

function statCard(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub?: string
) {
  slide.addShape("roundRect" as PptxGenJS.SHAPE_NAME, {
    x,
    y,
    w,
    h,
    fill: { color: COLOR.paperLight },
    line: { color: COLOR.lineGrey, width: 1 },
    rectRadius: 0.05,
  });
  slide.addText(label, { x: x + 0.18, y: y + 0.1, w: w - 0.36, h: 0.25, fontFace: FONT, fontSize: 9.5, bold: true, color: COLOR.inkSoft });
  slide.addText(value, { x: x + 0.18, y: y + 0.36, w: w - 0.36, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: COLOR.ink });
  if (sub) {
    slide.addText(sub, { x: x + 0.18, y: y + 0.73, w: w - 0.36, h: 0.25, fontFace: FONT, fontSize: 9, color: COLOR.inkSoft });
  }
}

// ---------- Slide 1: case info + team org chart ----------

function addOrgChart(slide: PptxGenJS.Slide, c: Case, y: number, h: number) {
  const branchW = (CONTENT_W - 0.6) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + branchW + 0.6;
  const leftCenter = leftX + branchW / 2;
  const rightCenter = rightX + branchW / 2;

  const rootW = 2.3;
  const rootH = 0.42;
  const rootCenter = (leftCenter + rightCenter) / 2;
  const rootY = y;
  const trunkY = rootY + rootH + 0.28;
  const branchY = trunkY + 0.28;
  const branchH = h - (branchY - y);

  // Root box + stub down to the trunk line
  slide.addShape("roundRect" as PptxGenJS.SHAPE_NAME, {
    x: rootCenter - rootW / 2,
    y: rootY,
    w: rootW,
    h: rootH,
    fill: { color: COLOR.ink },
    line: { type: "none" },
    rectRadius: 0.05,
  });
  slide.addText("備標團隊", {
    x: rootCenter - rootW / 2,
    y: rootY,
    w: rootW,
    h: rootH,
    fontFace: FONT,
    fontSize: 13,
    bold: true,
    color: COLOR.paperLight,
    align: "center",
    valign: "middle",
  });
  slide.addShape("line" as PptxGenJS.SHAPE_NAME, {
    x: rootCenter,
    y: rootY + rootH,
    w: 0,
    h: trunkY - (rootY + rootH),
    line: { color: COLOR.lineGrey, width: 1.5 },
  });
  // Horizontal trunk connecting both branches, plus stubs down into each branch box
  addRule(slide, leftCenter, trunkY, rightCenter - leftCenter);
  slide.addShape("line" as PptxGenJS.SHAPE_NAME, { x: leftCenter, y: trunkY, w: 0, h: branchY - trunkY, line: { color: COLOR.lineGrey, width: 1.5 } });
  slide.addShape("line" as PptxGenJS.SHAPE_NAME, { x: rightCenter, y: trunkY, w: 0, h: branchY - trunkY, line: { color: COLOR.lineGrey, width: 1.5 } });

  const branchBox = (x: number, title: string, names: string[]) => {
    slide.addShape("roundRect" as PptxGenJS.SHAPE_NAME, {
      x,
      y: branchY,
      w: branchW,
      h: branchH,
      fill: { color: COLOR.white },
      line: { color: COLOR.lineGrey, width: 1 },
      rectRadius: 0.05,
    });
    slide.addText(title, {
      x: x + 0.2,
      y: branchY + 0.15,
      w: branchW - 0.4,
      h: 0.35,
      fontFace: FONT,
      fontSize: 13,
      bold: true,
      color: COLOR.ink,
    });
    slide.addText(names.length ? names.join("、") : "尚未指定", {
      x: x + 0.2,
      y: branchY + 0.6,
      w: branchW - 0.4,
      h: branchH - 0.8,
      fontFace: FONT,
      fontSize: 12,
      color: COLOR.inkSoft,
      valign: "top",
      lineSpacingMultiple: 1.35,
    });
  };

  const architectNames = [
    ...c.team.architect.filter(Boolean),
    ...c.team.mep.filter(Boolean),
    ...c.team.consultants.filter((x) => x.team === "architect").map((x) => `${x.role}（${x.contact || x.company || "未定"}）`),
  ];
  const jianguoNames = c.team.consultants
    .filter((x) => x.team === "jianguo")
    .map((x) => `${x.role}（${x.contact || x.company || "未定"}）`);

  branchBox(leftX, "建築師團隊", architectNames);
  branchBox(rightX, "建國工程團隊", jianguoNames);
}

function buildSlide1(pptx: PptxGenJS, c: Case, index: number, total: number) {
  const slide = pptx.addSlide();
  addChrome(slide, c.name, index, total);

  const daysLeft = caseDaysLeft(c);
  slide.addText(c.name, {
    x: MARGIN_X,
    y: 0.65,
    w: CONTENT_W,
    h: 0.6,
    fontFace: FONT,
    fontSize: 24,
    bold: true,
    color: COLOR.ink,
    valign: "top",
  });
  slide.addText(
    [
      { text: "主投標手：", options: { color: COLOR.inkSoft, fontSize: 12, fontFace: FONT } },
      { text: `${c.bidLead || "—"}     `, options: { color: COLOR.ink, bold: true, fontSize: 12, fontFace: FONT } },
      { text: "投標截止：", options: { color: COLOR.inkSoft, fontSize: 12, fontFace: FONT } },
      { text: `${fmtDeadline(c.deadline)}     `, options: { color: COLOR.ink, bold: true, fontSize: 12, fontFace: FONT } },
      { text: "剩餘天數：", options: { color: COLOR.inkSoft, fontSize: 12, fontFace: FONT } },
      {
        text: daysLeft >= 0 ? `${daysLeft} 天` : `已逾期 ${-daysLeft} 天`,
        options: { color: daysLeft < 0 ? COLOR.danger : COLOR.chopRed, bold: true, fontSize: 12, fontFace: FONT },
      },
    ],
    { x: MARGIN_X, y: 1.3, w: CONTENT_W, h: 0.35 }
  );

  const cardW = (CONTENT_W - 0.6) / 4;
  const cardY = 1.8;
  statCard(slide, MARGIN_X, cardY, cardW, 0.95, "契約金額", fmtMoney(c.contractAmount));
  statCard(slide, MARGIN_X + (cardW + 0.2) * 1, cardY, cardW, 0.95, "基地面積", c.siteArea ? `${c.siteArea.toLocaleString("zh-TW")} m²` : "—");
  statCard(
    slide,
    MARGIN_X + (cardW + 0.2) * 2,
    cardY,
    cardW,
    0.95,
    "樓地板面積",
    c.floorArea ? `${c.floorArea.toLocaleString("zh-TW")} m²` : "—"
  );
  statCard(slide, MARGIN_X + (cardW + 0.2) * 3, cardY, cardW, 0.95, "預計設計樓層", c.floorCount || "—");

  addSectionTitle(slide, "備標團隊組織圖", 3.05);
  addOrgChart(slide, c, 3.75, SLIDE_H - 0.3 - 3.75);
}

// ---------- Slide 2: progress + milestone list ----------

function buildSlide2(pptx: PptxGenJS, c: Case, index: number, total: number) {
  const slide = pptx.addSlide();
  addChrome(slide, c.name, index, total);
  addSectionTitle(slide, "整體進度", 0.7);

  const { doneCount, total: totalCheckable, pct } = caseProgress(c);
  slide.addText(`${pct}%`, {
    x: SLIDE_W - MARGIN_X - 3,
    y: 1.35,
    w: 3,
    h: 0.7,
    fontFace: FONT,
    fontSize: 34,
    bold: true,
    color: COLOR.navy,
    align: "right",
  });
  slide.addText(`${doneCount} / ${totalCheckable} 項已完成`, {
    x: MARGIN_X,
    y: 1.55,
    w: 6,
    h: 0.35,
    fontFace: FONT,
    fontSize: 13,
    bold: true,
    color: COLOR.inkSoft,
  });
  const barY = 2.15;
  slide.addShape("roundRect" as PptxGenJS.SHAPE_NAME, {
    x: MARGIN_X,
    y: barY,
    w: CONTENT_W,
    h: 0.4,
    fill: { color: COLOR.skyPale },
    line: { color: COLOR.lineGrey, width: 1 },
    rectRadius: 0.07,
  });
  if (pct > 0) {
    slide.addShape("roundRect" as PptxGenJS.SHAPE_NAME, {
      x: MARGIN_X,
      y: barY,
      w: Math.max((CONTENT_W * pct) / 100, 0.4),
      h: 0.4,
      fill: { color: COLOR.sky },
      line: { type: "none" },
      rectRadius: 0.07,
    });
  }

  addSectionTitle(slide, "大事記列表", 2.95);
  const milestones = buildMilestoneList(c);
  const header: PptxGenJS.TableRow = [
    { text: "項目", options: { bold: true, fill: { color: COLOR.white }, color: COLOR.inkSoft, fontSize: 11 } },
    { text: "日期", options: { bold: true, fill: { color: COLOR.white }, color: COLOR.inkSoft, fontSize: 11 } },
    { text: "狀態", options: { bold: true, fill: { color: COLOR.white }, color: COLOR.inkSoft, fontSize: 11 } },
  ];
  const rows: PptxGenJS.TableRow[] =
    milestones.length > 0
      ? milestones.map((m) => [
          { text: m.label, options: { fontSize: 13, color: COLOR.ink } },
          { text: m.due, options: { fontSize: 13, color: COLOR.inkSoft, fontFace: "Consolas" } },
          { text: MILESTONE_STATUS_LABEL[m.status], options: { fontSize: 13, bold: m.status === "overdue", color: MILESTONE_STATUS_COLOR[m.status] } },
        ])
      : [[{ text: "目前尚未設定任何大事記項目（可於任務清單點選星號設定）", options: { fontSize: 12, color: COLOR.inkSoft } }, { text: "", options: {} }, { text: "", options: {} }]];
  slide.addTable([header, ...rows], {
    x: MARGIN_X,
    y: 3.5,
    w: CONTENT_W,
    h: SLIDE_H - 0.4 - 3.5,
    fontFace: FONT,
    border: { type: "solid", color: COLOR.lineGrey, pt: 0.5 },
    // pptxgenjs's autoPage feature has edge-case bugs that throw even with all documented
    // options set correctly — milestones are user-curated (only starred tasks) and realistically
    // few, so a fixed single-slide table is the safer choice here over a flaky library feature.
    autoPage: false,
    colW: [CONTENT_W * 0.55, CONTENT_W * 0.2, CONTENT_W * 0.25],
  });
}

// ---------- Slide 3+: one calendar month per slide (left ~80%) + overdue list (right ~20%) ----------

function buildCalendarSlide(
  pptx: PptxGenJS,
  c: Case,
  calMonth: CalendarMonth,
  overdue: ReturnType<typeof overdueTasks>,
  index: number,
  total: number
) {
  const slide = pptx.addSlide();
  addChrome(slide, c.name, index, total);
  addSectionTitle(slide, `行事曆・${calMonth.monthLabel}`, 0.7);

  const gap = 0.25;
  const leftW = CONTENT_W * 0.8 - gap / 2;
  const rightW = CONTENT_W * 0.2 - gap / 2;
  const rightX = MARGIN_X + leftW + gap;
  const tableY = 1.45;
  const tableH = SLIDE_H - 0.35 - tableY;

  const weekdayHeader: PptxGenJS.TableRow = ["日", "一", "二", "三", "四", "五", "六"].map((d) => ({
    text: d,
    options: { bold: true, fill: { color: COLOR.skyPale }, color: COLOR.inkSoft, fontSize: 10, align: "center" },
  }));
  const MAX_TASKS_PER_CELL = 3;
  // Mirrors CalendarView's day cell exactly, not a text summary of it: each task gets a coloured
  // dot in its actual category color (same hex as CATEGORY_HEX/CalendarView's --color-* vars), a
  // ★ + bold + highlight color for milestones (matching the web's star-icon + highlight-soft
  // treatment), and strikethrough for done tasks — so a task's category and status both stay
  // visually readable at a glance, the exact complaint about the old plain-text version.
  const dayCellRuns = (day: CalendarDay): PptxGenJS.TableCell[] => {
    const dateColor = day.inMonth ? COLOR.inkSoft : COLOR.lineGrey;
    const runs: PptxGenJS.TableCell[] = [{ text: `${day.date}`, options: { color: dateColor, bold: true, fontSize: 9, breakLine: true } }];
    const visible = day.tasks.slice(0, MAX_TASKS_PER_CELL);
    const hidden = day.tasks.length - visible.length;
    visible.forEach((t) => {
      if (t.milestone) {
        runs.push({ text: "★ ", options: { color: t.done ? COLOR.lineGrey : COLOR.highlight, bold: true, fontSize: 8 } });
        runs.push({
          text: t.label,
          options: { color: t.done ? COLOR.lineGrey : COLOR.ink, bold: true, fontSize: 8, breakLine: true },
        });
      } else {
        runs.push({ text: "● ", options: { color: t.done ? COLOR.lineGrey : CATEGORY_HEX[t.cat] ?? COLOR.inkSoft, fontSize: 8 } });
        runs.push({
          text: t.label,
          options: { color: t.done ? COLOR.lineGrey : COLOR.inkSoft, fontSize: 8, breakLine: true },
        });
      }
    });
    if (hidden > 0) {
      runs.push({ text: `+${hidden} 項`, options: { color: COLOR.inkSoft, italic: true, fontSize: 8, breakLine: true } });
    }
    return runs;
  };
  const calRows: PptxGenJS.TableRow[] = calMonth.weeks.map((week) =>
    week.map((day) => ({
      text: dayCellRuns(day),
      options: {
        fill: { color: day.isToday ? "DCEBE3" : COLOR.white },
        align: "left" as const,
        valign: "top" as const,
      },
    }))
  );
  slide.addTable([weekdayHeader, ...calRows], {
    x: MARGIN_X,
    y: tableY,
    w: leftW,
    h: tableH,
    fontFace: FONT,
    border: { type: "solid", color: COLOR.lineGrey, pt: 0.5 },
    autoPage: false,
    rowH: [0.3, ...calMonth.weeks.map(() => (tableH - 0.3) / calMonth.weeks.length)],
  });

  // Overdue list — a bordered box (not a table) since it's a simple text list, capped with a
  // "+N more" note if it would overflow rather than shrinking everything to fit.
  slide.addShape("roundRect" as PptxGenJS.SHAPE_NAME, {
    x: rightX,
    y: tableY,
    w: rightW,
    h: tableH,
    fill: { color: COLOR.white },
    line: { color: COLOR.danger, width: 1 },
    rectRadius: 0.05,
  });
  slide.addText("逾期事項", {
    x: rightX + 0.15,
    y: tableY + 0.12,
    w: rightW - 0.3,
    h: 0.3,
    fontFace: FONT,
    fontSize: 12,
    bold: true,
    color: COLOR.danger,
  });
  const MAX_OVERDUE_SHOWN = 18;
  const shown = overdue.slice(0, MAX_OVERDUE_SHOWN);
  const overdueLines: { text: string; options: Record<string, unknown> }[] = shown.length
    ? shown.map((t) => ({
        text: `${t.due}\n${t.label}`,
        options: { fontSize: 9.5, color: COLOR.ink, fontFace: FONT, breakLine: true, paraSpaceAfter: 5 },
      }))
    : [{ text: "目前沒有逾期項目", options: { fontSize: 10, color: COLOR.inkSoft, fontFace: FONT } }];
  if (overdue.length > MAX_OVERDUE_SHOWN) {
    overdueLines.push({
      text: `…等共 ${overdue.length} 項`,
      options: { fontSize: 9, color: COLOR.inkSoft, fontFace: FONT, italic: true },
    });
  }
  slide.addText(overdueLines, {
    x: rightX + 0.15,
    y: tableY + 0.48,
    w: rightW - 0.3,
    h: tableH - 0.6,
    valign: "top",
    lineSpacingMultiple: 1.1,
  });
}

export async function buildProjectPptx(c: Case): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "BID_16x9", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "BID_16x9";
  pptx.author = "業務投標管理平台 Bigmaster";
  pptx.title = `${c.name} 專案進度簡報`;

  const calendarMonths = buildAllMonthsCalendars(c);
  const overdue = overdueTasks(c);
  const TOTAL = 2 + calendarMonths.length;

  buildSlide1(pptx, c, 1, TOTAL);
  buildSlide2(pptx, c, 2, TOTAL);
  calendarMonths.forEach((calMonth, i) => {
    buildCalendarSlide(pptx, c, calMonth, overdue, 3 + i, TOTAL);
  });

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}
