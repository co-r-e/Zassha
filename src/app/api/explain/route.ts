import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 300; // allow longer processing for large videos
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Simple path: use formData (sufficient for current UX). For very large files, move to signed uploads.
    const fd = await req.formData();
    const file = fd.get("file");
    const hint = (fd.get("hint") as string | null) || "";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const upload = await ai.files.upload({ file });

    // Wait until the uploaded file is ACTIVE before using it
    const name = upload.name;
    if (!name) {
      throw new Error("Upload did not return a file name");
    }

    const waitUntilActive = async () => {
      // quick path: if already ACTIVE
      if (upload.state === "ACTIVE") return upload;
      const maxWaitMs = Number(process.env.GEMINI_FILE_WAIT_MS ?? "240000"); // default 4min
      const start = Date.now();
      let latest = upload;
      let sleepMs = 1200;
      while (latest.state !== "ACTIVE") {
        if (latest.state === "FAILED") {
          throw new Error(latest.error?.message || "File processing failed");
        }
        if (Date.now() - start > maxWaitMs) {
          throw new Error("Timed out waiting for file to become ACTIVE");
        }
        await new Promise((r) => setTimeout(r, sleepMs));
        // exponential backoff up to 5s
        sleepMs = Math.min(5000, Math.round(sleepMs * 1.5));
        latest = await ai.files.get({ name });
      }
      return latest;
    };

    const activeFile = await waitUntilActive();

    // no temp files used in this mode

    // Generate explanation as Markdown table with 4 columns (phase/task/step/time)
    const prompt =
      `あなたは動画から手順書を作るアシスタントです。出力はマークダウンの表のみで返してください。コードブロック、前置き、後書き、補足文は一切出力しないでください。表の列は左から必ず『業務工程 | 業務詳細』の順にしてください。他の列（時間・タスク・ステップなど）は作らないでください。業務詳細は一挙手一投足の最小粒度で記述し、1操作=1行としてください。マウス移動/ホバー/クリック/ドラッグ/ドロップ/キー入力/ウィンドウ切替/読み込み表示/エラートーストなども各行で明示し、ボタン名・UI部品名・入力値・メニュー階層・フォーカス対象など具体名を含めて端的に書いてください。

参考情報（任意）: ${hint ? hint : "(特になし)"}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { fileData: { mimeType: activeFile.mimeType!, fileUri: activeFile.uri! } },
          ],
        },
      ],
      config: {
        temperature: 0.4,
        maxOutputTokens: 8000,
      },
    });

    const text = response.text ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "internal error" },
      { status: 500 }
    );
  }
}

