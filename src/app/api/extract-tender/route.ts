import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractTenderText } from "@/lib/tenderExtract/extractText";
import { parseTenderFields } from "@/lib/tenderExtract/parseFields";
import { extractFieldsWithLLM } from "@/lib/tenderExtract/parseFieldsWithLLM";

// OCR + text extraction always runs the same way regardless of what parses the resulting text (no
// external AI API for that half — see docs/DECISIONS.md for why the original Anthropic-API version
// was replaced). Field extraction itself now prefers the user's self-hosted LLM (LOCAL_LLM_URL/
// LOCAL_LLM_SECRET, same one powering 系統助理) when configured and reachable, since it generalizes
// far better to varied document layouts than the keyword/regex fallback — but a down/unreachable
// local model (a real risk: it depends on the user's own machine being on) must never make this
// feature regress below the regex parser's baseline, so any LLM failure here is swallowed and falls
// through to it rather than failing the request.

const MAX_FILES = 5;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// OCR (tesseract.js) alone can take 7-9+ seconds per scanned page, plus tesseract.js re-downloads
// its chi_tra+eng language data on every cold start (cachePath is pinned to /tmp, which doesn't
// persist between invocations on Vercel) — a multi-page scanned upload can easily exceed Vercel's
// default serverless timeout (10s on Hobby) well before OCR even finishes. Raised explicitly so a
// slow-but-working extraction doesn't get killed mid-request and surface as a generic failure.
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "請至少上傳一個檔案" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `一次最多上傳 ${MAX_FILES} 個檔案` }, { status: 400 });
  }

  const tenderFiles = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `檔案「${file.name}」超過 15MB 上限` }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `不支援的檔案格式：${file.name}（僅支援 PDF 或圖片）` }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    tenderFiles.push({ buffer, mimeType: file.type, name: file.name });
  }

  try {
    const { text, ocrPageCount } = await extractTenderText(tenderFiles);
    if (!text.trim()) {
      return NextResponse.json({ error: "無法從檔案中讀出任何文字，請確認檔案內容清晰可讀。" }, { status: 502 });
    }

    let fields;
    let method: "llm" | "regex" = "regex";
    try {
      const llmFields = await extractFieldsWithLLM(text);
      if (llmFields) {
        fields = llmFields;
        method = "llm";
      }
    } catch (err) {
      console.error("LLM field extraction failed, falling back to regex:", err);
    }
    if (!fields) fields = parseTenderFields(text);

    return NextResponse.json({ fields, ocrPageCount, method });
  } catch (err) {
    console.error(err);
    // Surfaces the actual thrown error (not just a generic message) directly in the alert the user
    // already sees — without this, diagnosing a production-only failure requires pulling Vercel's
    // function logs, which has been the actual bottleneck across several rounds of "still broken"
    // reports with no further detail. Safe to expose here: this is an internal tool behind auth,
    // not a public endpoint, and the error is about file-processing internals, not user data.
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json({ error: `文件判讀失敗：${message}` }, { status: 502 });
  }
}
