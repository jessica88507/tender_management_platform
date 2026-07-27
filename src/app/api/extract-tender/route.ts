import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

// Server-side only, by design: the original spec's tender-document auto-read feature called the
// Anthropic API directly from client-side JS, which would ship the API key in the browser bundle.
// This route holds the key server-side and the browser only ever talks to this route.

const MAX_FILES = 5;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const EXTRACT_PROMPT = `你是招標文件判讀助手。請閱讀以上文件內容，找出以下欄位的值，並「只」回傳一個 JSON 物件（不要包含任何其他文字或 markdown code fence）：
{
  "contractAmount": number | null,
  "siteArea": number | null,
  "floorArea": number | null,
  "floorCount": string | null,
  "tenderStart": string | null,
  "deadline": string | null
}
欄位說明：
- contractAmount：契約金額／預算金額，單位為新台幣元的整數（例如 8500000000）
- siteArea：基地面積，單位平方公尺的數字
- floorArea：總樓地板面積，單位平方公尺的數字
- floorCount：樓層描述文字，例如「地上12層/地下3層」
- tenderStart：招標公告日期，格式 YYYY-MM-DD
- deadline：投標截止日期時間，格式 YYYY-MM-DDTHH:mm
找不到的欄位請填 null，不要用猜測或編造的數字，寧可留空。`;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "伺服器尚未設定 ANTHROPIC_API_KEY，此功能目前無法使用，請聯繫系統管理員設定。" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "請至少上傳一個檔案" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `一次最多上傳 ${MAX_FILES} 個檔案` }, { status: 400 });
  }

  const contentBlocks: Anthropic.ContentBlockParam[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `檔案「${file.name}」超過 15MB 上限` }, { status: 400 });
    }
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    if (file.type === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
        title: file.name,
      });
    } else if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
      });
    } else {
      return NextResponse.json({ error: `不支援的檔案格式：${file.name}（僅支援 PDF 或圖片）` }, { status: 400 });
    }
  }
  contentBlocks.push({ type: "text", text: EXTRACT_PROMPT });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: contentBlocks }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI 無法判讀出結構化資料，請確認文件內容清晰可讀。" }, { status: 502 });
    }
    const fields = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ fields });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "文件判讀失敗，請稍後再試。" }, { status: 502 });
  }
}
