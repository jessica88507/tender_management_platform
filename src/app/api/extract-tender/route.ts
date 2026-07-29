import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractTenderText } from "@/lib/tenderExtract/extractText";
import { parseTenderFields } from "@/lib/tenderExtract/parseFields";

// Rule-based (OCR + keyword/regex) extraction — no external AI API, so no per-request cost and no
// API key to provision. Runs entirely inside this one serverless function: pdfjs-dist reads a
// PDF's text layer directly (pure JS, no native deps), and tesseract.js OCRs plain image uploads
// (ships its own WASM binary, no system Tesseract install needed) — both fit Vercel's serverless
// Node runtime. See docs/DECISIONS.md for why this replaced the earlier Anthropic-API version and
// what its accuracy trade-offs are.

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
    const fields = parseTenderFields(text);
    return NextResponse.json({ fields, ocrPageCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "文件判讀失敗，請稍後再試。" }, { status: 502 });
  }
}
