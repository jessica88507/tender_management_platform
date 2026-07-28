// Rule-based (keyword/synonym + regex) field extraction — the non-AI alternative to calling an
// LLM. Every field the caller cares about can legitimately come back null: tender documents vary
// wildly in layout and wording across issuing agencies, so "didn't find it" is a normal, expected
// outcome here, not a bug. The UI already treats every extracted field as a draft the user reviews
// and edits before saving (see InfoPanel's handleExtract), so an occasional miss or near-miss is
// an acceptable cost for not depending on a paid LLM API.

export type TenderFields = {
  contractAmount: number | null;
  siteArea: number | null;
  floorArea: number | null;
  floorCount: string | null;
  tenderStart: string | null;
  deadline: string | null;
  ownerOrg: string | null;
  userUnit: string | null;
  location: string | null;
  contractMode: string | null;
  contractScope: string | null;
  supervisorUnit: string | null;
  buildingType: string | null;
  constructionPeriod: string | null;
  specialNotes: string | null;
};

function toHalfWidthDigits(s: string): string {
  // OCR occasionally emits full-width digits (０-９) — normalize before any numeric regex runs.
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** ROC (民國) or Gregorian "YYYY年MM月DD日" style date → "YYYY-MM-DD". */
function parseDate(raw: string): string | null {
  const s = toHalfWidthDigits(raw);
  let m = s.match(/(?<!\d)(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const rocYear = Number(m[1]);
    // Anything below ~200 reads as an ROC year (114年 = 2025); a 4-digit year is already Gregorian
    // written with "年/月/日" instead of "-"/"/" separators.
    const year = rocYear < 200 ? rocYear + 1911 : rocYear;
    return `${year}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
  }
  // "-"/"/"-separated dates: government portals commonly print ROC dates this way too (e.g.
  // "115/06/25" for a 公告日, "115/08/10" for a deadline) — not just the "年月日" form above — so
  // the same ROC-vs-Gregorian threshold applies here, not just a 4-digit-year Gregorian case.
  m = s.match(/(?<!\d)(\d{2,4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})(?!\d)/);
  if (m) {
    const rawYear = Number(m[1]);
    const year = rawYear < 200 ? rawYear + 1911 : rawYear;
    return `${year}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
  }
  return null;
}

/** "9時20分" / "09:20" / "9:20" → "09:20". Returns null (not a default) when no time is present. */
function parseTime(raw: string): string | null {
  const s = toHalfWidthDigits(raw);
  const m = s.match(/(\d{1,2})\s*[時:]\s*(\d{1,2})\s*分?/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "8,500,000,000元" / "85億元" / "8,500萬元" / "8億5,000萬元" → integer NTD. */
function parseMoney(raw: string): number | null {
  const s = toHalfWidthDigits(raw).replace(/,/g, "");
  let total = 0;
  let matched = false;
  const yi = s.match(/([\d.]+)\s*億/);
  if (yi) {
    total += parseFloat(yi[1]) * 1e8;
    matched = true;
  }
  const wan = s.match(/([\d.]+)\s*萬/);
  if (wan) {
    total += parseFloat(wan[1]) * 1e4;
    matched = true;
  }
  if (!matched) {
    // Require at least 4 digits so a stray page/section number ("第3條") doesn't get mistaken for
    // an amount — real contract amounts are never that small.
    const plain = s.match(/\d{4,}(?:\.\d+)?/);
    if (plain) {
      total = parseFloat(plain[0]);
      matched = true;
    }
  }
  return matched ? Math.round(total) : null;
}

/** A plain decimal number, e.g. from "12,345.6平方公尺" → 12345.6. */
function parseDecimal(raw: string): number | null {
  const s = toHalfWidthDigits(raw).replace(/,/g, "");
  const m = s.match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

// A real form label sits at (or very near) the start of its line/table cell — a match deep inside
// a line is almost always the label text turning up incidentally inside an unrelated sentence
// (e.g. OCR'd body text like "...應以書面向招標機關請求釋疑之期限..." contains "招標機關" purely by
// coincidence, nowhere near an actual "機關名稱：X" field). A small tolerance (rather than
// requiring index 0) allows for a stray leading character bleeding in from an adjacent table
// column, which does happen in both the pdfjs and OCR text-reconstruction paths. Only applied
// when `nearStart` is requested (see extractText) — numeric fields (extractNear) re-scan the
// *whole* matched line for a number pattern regardless of where the label sits in it, so
// requiring the label itself to be near the start would reject perfectly usable lines for no
// benefit (and OCR merging multiple table rows onto one line means the label sometimes legitimately
// sits mid-line while the value is still right there in the same line).
const LABEL_START_TOLERANCE = 20;

/** First line containing a label, together with the next line for context. `labels` is tried in
 * order across the *whole* document before falling back to the next (less specific) synonym —
 * not line-by-line — so a generic label (e.g. "招標公告") occurring earlier in the text (say, in a
 * document title) can't shadow a more specific one (e.g. "招標公告日期") that appears later. */
function findLabelLines(
  lines: string[],
  labels: string[],
  nearStart = false
): { line: string; next: string } | null {
  for (const label of labels) {
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].indexOf(label);
      if (idx !== -1 && (!nearStart || idx <= LABEL_START_TOLERANCE)) {
        return { line: lines[i], next: lines[i + 1] ?? "" };
      }
    }
  }
  return null;
}

function extractNear<T>(lines: string[], labels: string[], extractor: (window: string) => T | null): T | null {
  const found = findLabelLines(lines, labels);
  if (!found) return null;
  return extractor(found.line) ?? extractor(found.next);
}

// Every label any field looks for, in one flat list — used only to detect "another field's label
// starts here" as a stop point (see extractText below), so an OCR'd page that ran two table rows
// together on one line doesn't bleed the next row's whole label+value into this field's answer.
// Populated once parseTenderFields defines its per-field label lists (see bottom of this file).
let ALL_FIELD_LABELS: string[] = [];

/** Text-value fields: grab whatever follows the matched label on its own line (after stripping
 * the label itself and any leading "："/":"/space), stopping at the next field's label if one
 * appears on the same line — OCR sometimes runs multiple table rows together into a single text
 * line, and without this a long value swallows the next row's label and content too. Falls back
 * to the next line if the label's own line has nothing left after the label — some layouts put
 * the label alone on a heading line with the value in the row/line below. */
function extractText(lines: string[], labels: string[], maxLen = 60): string | null {
  const found = findLabelLines(lines, labels, true);
  if (!found) return null;
  const label = labels.find((l) => found.line.includes(l))!;
  const idx = found.line.indexOf(label);
  let rest = found.line.slice(idx + label.length).replace(/^[\s：:、,，]+/, "").trim();
  if (!rest) rest = found.next.trim();
  if (!rest) return null;

  let cutAt = rest.length;
  for (const otherLabel of ALL_FIELD_LABELS) {
    if (otherLabel === label) continue;
    const otherIdx = rest.indexOf(otherLabel);
    if (otherIdx !== -1 && otherIdx > 0) cutAt = Math.min(cutAt, otherIdx);
  }
  rest = rest.slice(0, cutAt).trim();

  return rest.slice(0, maxLen);
}

const TENDER_START_LABELS = ["招標公告日期", "公告日期", "公告日", "招標公告"];
const DEADLINE_LABELS = ["截止投標", "投標截止", "開標時間", "截止日期"];
const CONTRACT_AMOUNT_LABELS = ["契約金額", "預算金額", "採購金額", "底價"];
const SITE_AREA_LABELS = ["基地面積"];
const FLOOR_AREA_LABELS = ["總樓地板面積", "樓地板面積"];
const OWNER_ORG_LABELS = ["機關名稱", "招標機關", "採購機關", "業主"];
const USER_UNIT_LABELS = ["使用機關", "使用單位", "需求單位", "單位名稱"];
const LOCATION_LABELS = ["履約地點", "工程地點", "基地地點", "案址"];
const CONTRACT_MODE_LABELS = ["招標方式", "契約性質", "契約模式"];
const CONTRACT_SCOPE_LABELS = ["承攬範圍", "工程範圍"];
const SUPERVISOR_UNIT_LABELS = ["監造單位"];
const BUILDING_TYPE_LABELS = ["建築形式", "棟數"];
const CONSTRUCTION_PERIOD_LABELS = ["履約期限", "合約工期", "工期"];
const SPECIAL_NOTES_LABELS = ["特殊說明", "認證要求", "特殊規定"];

ALL_FIELD_LABELS = [
  ...OWNER_ORG_LABELS,
  ...USER_UNIT_LABELS,
  ...LOCATION_LABELS,
  ...CONTRACT_MODE_LABELS,
  ...CONTRACT_SCOPE_LABELS,
  ...SUPERVISOR_UNIT_LABELS,
  ...BUILDING_TYPE_LABELS,
  ...CONSTRUCTION_PERIOD_LABELS,
  ...SPECIAL_NOTES_LABELS,
];

export function parseTenderFields(text: string): TenderFields {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tenderStart = extractNear(lines, TENDER_START_LABELS, parseDate);

  const deadlineFound = findLabelLines(lines, DEADLINE_LABELS);
  let deadline: string | null = null;
  if (deadlineFound) {
    const combined = `${deadlineFound.line} ${deadlineFound.next}`;
    const date = parseDate(combined);
    const time = parseTime(combined);
    if (date) deadline = time ? `${date}T${time}` : `${date}T00:00`;
  }

  const contractAmount = extractNear(lines, CONTRACT_AMOUNT_LABELS, parseMoney);
  const siteArea = extractNear(lines, SITE_AREA_LABELS, parseDecimal);
  const floorArea = extractNear(lines, FLOOR_AREA_LABELS, parseDecimal);

  let floorCount: string | null = null;
  const floorMatch = text.match(/地上\s*(\d+)\s*層/);
  const floorMatchB = text.match(/地下\s*(\d+)\s*層/);
  if (floorMatch || floorMatchB) {
    const parts = [];
    if (floorMatch) parts.push(`地上${floorMatch[1]}層`);
    if (floorMatchB) parts.push(`地下${floorMatchB[1]}層`);
    floorCount = parts.join("/");
  }

  const ownerOrg = extractText(lines, OWNER_ORG_LABELS);
  const userUnit = extractText(lines, USER_UNIT_LABELS);
  const location = extractText(lines, LOCATION_LABELS, 80);
  const contractMode = extractText(lines, CONTRACT_MODE_LABELS);
  const contractScope = extractText(lines, CONTRACT_SCOPE_LABELS, 80);
  const supervisorUnit = extractText(lines, SUPERVISOR_UNIT_LABELS);
  const buildingType = extractText(lines, BUILDING_TYPE_LABELS, 80) ?? floorCount;
  const constructionPeriod = extractText(lines, CONSTRUCTION_PERIOD_LABELS, 60);
  const specialNotes = extractText(lines, SPECIAL_NOTES_LABELS, 120);

  return {
    contractAmount,
    siteArea,
    floorArea,
    floorCount,
    tenderStart,
    deadline,
    ownerOrg,
    userUnit,
    location,
    contractMode,
    contractScope,
    supervisorUnit,
    buildingType,
    constructionPeriod,
    specialNotes,
  };
}
