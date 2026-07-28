import { createWorker, OEM, type Worker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";

// Vercel's serverless functions only allow writes under /tmp — tesseract.js otherwise defaults to
// caching downloaded language data in the current working directory, which is read-only there
// (and would just mean redownloading the ~2-5MB per-language traineddata on every cold start
// either way, since /tmp itself doesn't persist across invocations).
const TESSERACT_OPTIONS = { cachePath: "/tmp" };

// pdfjs-dist's default build assumes a browser (Worker via new URL(), DOMMatrix, etc.) — the
// "legacy" build is the one meant to run under plain Node, which is what every Vercel serverless
// function is.
async function loadPdfjs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

type TextItemLike = { str: string; transform: number[] };

// Reconstructs per-line text from pdfjs's flat item list using each item's y-position
// (content.items has no built-in line breaks) — this matters a lot for the keyword/regex field
// parser downstream, which looks for a value on the same line as its label; without this, a whole
// page collapses into one run-on string and every label ends up glued to whatever text happened
// to follow it in reading order.
function linesFromTextContent(items: TextItemLike[]): string[] {
  let lastY: number | null = null;
  let line = "";
  const lines: string[] = [];
  for (const item of items) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(line);
      line = "";
    }
    line += item.str;
    lastY = y;
  }
  if (line) lines.push(line);
  return lines;
}

// A real tender PDF page has at minimum a few dozen characters of boilerplate — a handful of
// stray characters (or none) means this page's text layer is effectively empty, i.e. it's a
// scanned/image-only page and needs the OCR fallback below instead.
const MIN_CHARS_PER_PAGE = 20;

type PdfPageResult = { pageNumber: number; text: string; needsOcr: boolean };

// Tender announcements published by government agencies are sometimes a digitally generated PDF
// (a text layer) and sometimes a scan or a browser "print to PDF" of a webpage rendered as one
// image per page — both are common in practice. This always reads the text layer first per page
// (fast, exact, no OCR cost) and only flags the pages that need rendering+OCR, rather than
// deciding scanned-vs-not for the whole document from a single page.
export async function extractTextFromPdf(buffer: Buffer): Promise<PdfPageResult[]> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const pages: PdfPageResult[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item) as TextItemLike[];
    const text = linesFromTextContent(items).join("\n");
    pages.push({ pageNumber: i, text, needsOcr: text.trim().length < MIN_CHARS_PER_PAGE });
    page.cleanup();
  }
  await loadingTask.destroy();
  return pages;
}

// Renders the given pages of a PDF to PNG buffers, for the OCR fallback. Scale 2.0 (~144 DPI off a
// standard 72-DPI PDF unit) matches what these government-portal "print to PDF" scans actually
// need for OCR to read the small table text reliably — much lower and characters blur together.
// @napi-rs/canvas's Canvas is duck-type compatible with the browser's HTMLCanvasElement (2D
// context, toBuffer/toDataURL) — pdfjs-dist (v6+) takes it directly via the `canvas` param, no
// canvas-factory abstraction needed like older pdfjs versions required.
async function renderPdfPagesToPng(buffer: Buffer, pageNumbers: number[]): Promise<Buffer[]> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const doc = await loadingTask.promise;

  const buffers: Buffer[] = [];
  for (const pageNumber of pageNumbers) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    buffers.push(canvas.toBuffer("image/png"));
    page.cleanup();
  }
  await loadingTask.destroy();
  return buffers;
}

// OCR output glues CJK characters together with stray spaces between nearly every glyph (an
// artifact of how Tesseract's line/word segmentation works on non-spaced scripts) — e.g. "機關名稱"
// comes back as "機 關 名 稱". Collapsing that is essential for the label/value keyword parser,
// which matches literal substrings like "機關名稱" against the line.
function collapseCjkSpacing(text: string): string {
  const cjk = "一-鿿　-〿＀-￯";
  return text.replace(new RegExp(`([${cjk}])\\s+(?=[${cjk}])`, "gu"), "$1");
}

async function ocrBuffer(worker: Worker, buffer: Buffer): Promise<string> {
  const {
    data: { text },
  } = await worker.recognize(buffer);
  return collapseCjkSpacing(text);
}

// OCR path for plain image uploads (jpg/png/...) and for scanned PDF pages (see
// extractTenderText). Traditional Chinese + English covers every field label this feature looks
// for; tesseract.js ships its own WASM binary, no system Tesseract install required, so this runs
// fine in a serverless function — no persistent process, unlike a self-hosted LLM would need.
export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker("chi_tra+eng", OEM.LSTM_ONLY, TESSERACT_OPTIONS);
  try {
    return await ocrBuffer(worker, buffer);
  } finally {
    await worker.terminate();
  }
}

export type TenderFile = { buffer: Buffer; mimeType: string; name: string };

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function extractTenderText(files: TenderFile[]): Promise<{
  text: string;
  ocrPageCount: number;
}> {
  const texts: string[] = [];
  let ocrPageCount = 0;
  // One shared worker across every image/scanned-page in this request — spinning up a worker per
  // page would repeatedly redo language-data loading, which dominates OCR latency far more than
  // the actual recognition pass does.
  let worker: Worker | null = null;
  const getWorker = async () => {
    if (!worker) worker = await createWorker("chi_tra+eng", OEM.LSTM_ONLY, TESSERACT_OPTIONS);
    return worker;
  };

  try {
    for (const file of files) {
      if (file.mimeType === "application/pdf") {
        const pages = await extractTextFromPdf(file.buffer);
        const ocrPageNumbers = pages.filter((p) => p.needsOcr).map((p) => p.pageNumber);
        const ocrTextByPage = new Map<number, string>();
        if (ocrPageNumbers.length > 0) {
          const images = await renderPdfPagesToPng(file.buffer, ocrPageNumbers);
          const w = await getWorker();
          for (let i = 0; i < ocrPageNumbers.length; i++) {
            ocrTextByPage.set(ocrPageNumbers[i], await ocrBuffer(w, images[i]));
            ocrPageCount++;
          }
        }
        for (const p of pages) {
          texts.push(p.needsOcr ? ocrTextByPage.get(p.pageNumber) ?? "" : p.text);
        }
      } else if (IMAGE_MIME_TYPES.has(file.mimeType)) {
        const w = await getWorker();
        texts.push(await ocrBuffer(w, file.buffer));
      }
    }
  } finally {
    if (worker) await (worker as Worker).terminate();
  }

  return { text: texts.join("\n\n"), ocrPageCount };
}
