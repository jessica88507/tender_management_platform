import type { TenderFields } from "./parseFields";

// LLM-based alternative to parseFields.ts's keyword/regex matching — generalizes far better to
// freeform/varied document layouts (see CLAUDE.md's documented accuracy limits for the regex
// version), at the cost of depending on the user's own self-hosted model being reachable. The
// caller (extract-tender/route.ts) treats a null/thrown result here as "fall back to the regex
// parser" rather than a hard failure, so a down/unreachable local model never makes the feature
// regress below what it already did before this existed.

const FIELD_KEYS: (keyof TenderFields)[] = [
  "contractAmount",
  "siteArea",
  "floorArea",
  "floorCount",
  "tenderStart",
  "deadline",
  "ownerOrg",
  "userUnit",
  "location",
  "contractMode",
  "contractScope",
  "supervisorUnit",
  "buildingType",
  "constructionPeriod",
  "specialNotes",
];

const NUMBER_FIELDS = new Set<keyof TenderFields>(["contractAmount", "siteArea", "floorArea"]);

// Real tender documents can run long; the model only needs the header/basic-info section where
// these fields actually live (never buried at the very end), and a smaller prompt means faster,
// more reliable JSON-mode generation. 8000 chars comfortably covers every field-bearing section
// seen in real documents tested against this pipeline.
const MAX_INPUT_CHARS = 8000;

function buildPrompt(text: string): string {
  return `你是招標公告文件的資訊擷取助理。請閱讀以下招標文件內容，擷取指定欄位，只能回傳一個 JSON 物件，不要有任何其他文字、說明或 markdown 標記。

規則：
- 找不到的欄位一律填 null，不可以編造內容。
- contractAmount／siteArea／floorArea 必須是純數字（不含逗號、單位、字串），金額若寫「億」「萬」要換算成新台幣元的整數（例如 8.5億 → 850000000，8500萬 → 85000000）。
- tenderStart 與 deadline 是日期，格式為 "YYYY-MM-DD"（deadline 若有時間，格式為 "YYYY-MM-DDTHH:MM"）。文件中的民國年（例如114年）要換算成西元年（114+1911=2025）。
- 其餘欄位是文字，直接擷取原文用詞，不要超過 80 個字。

JSON 格式（欄位意義）：
{
  "contractAmount": 契約金額或預算金額（數字或null）,
  "siteArea": 基地面積，平方公尺（數字或null）,
  "floorArea": 總樓地板面積，平方公尺（數字或null）,
  "floorCount": 樓層數，例如「地上14層/地下3層」（字串或null）,
  "tenderStart": 招標公告日期（字串或null）,
  "deadline": 投標截止日期時間（字串或null）,
  "ownerOrg": 招標機關／業主（字串或null）,
  "userUnit": 使用機關／使用單位（字串或null）,
  "location": 履約地點／工程地點（字串或null）,
  "contractMode": 招標方式／契約模式（字串或null）,
  "contractScope": 承攬範圍（字串或null）,
  "supervisorUnit": 監造單位（字串或null）,
  "buildingType": 建築形式（字串或null）,
  "constructionPeriod": 履約期限／合約工期（字串或null）,
  "specialNotes": 特殊說明／認證要求（字串或null）
}

招標文件內容：
"""
${text.slice(0, MAX_INPUT_CHARS)}
"""`;
}

export async function extractFieldsWithLLM(text: string): Promise<TenderFields | null> {
  const llmUrl = process.env.LOCAL_LLM_URL;
  const llmSecret = process.env.LOCAL_LLM_SECRET;
  if (!llmUrl || !llmSecret) return null;

  const res = await fetch(`${llmUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmSecret}` },
    body: JSON.stringify({
      model: "qwen2.5:14b",
      prompt: buildPrompt(text),
      format: "json",
      stream: false,
      options: { num_ctx: 8192, temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`本機模型回應失敗（${res.status}）`);

  const data = (await res.json()) as { response?: string };
  if (!data.response) throw new Error("本機模型沒有回傳任何內容");

  const parsed = JSON.parse(data.response) as Record<string, unknown>;

  const fields: Record<string, number | string | null> = {};
  for (const key of FIELD_KEYS) {
    const value = parsed[key];
    if (NUMBER_FIELDS.has(key)) {
      fields[key] = typeof value === "number" && Number.isFinite(value) ? value : null;
    } else {
      fields[key] = typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
    }
  }
  // Mirrors parseFields.ts's own fallback: 建築形式 and 樓層數 describe overlapping information in
  // most real documents (and in this prompt's field descriptions), so the model sometimes puts the
  // floor breakdown under one and leaves the other null — treat floorCount as a reasonable stand-in
  // for buildingType when the model didn't fill it in directly.
  if (!fields.buildingType && fields.floorCount) fields.buildingType = fields.floorCount;
  return fields as unknown as TenderFields;
}
