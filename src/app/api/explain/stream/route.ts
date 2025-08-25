import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function writeEvent(controller: ReadableStreamDefaultController, data: unknown) {
  const line = JSON.stringify(data) + "\n";
  controller.enqueue(new TextEncoder().encode(line));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set" }), { status: 500 });
  }
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "file is required" }), { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        writeEvent(controller, { phase: "upload", progress: 10, message: "uploading" });
        const upload = await ai.files.upload({ file });
        writeEvent(controller, { phase: "uploaded", progress: 30 });

        // wait ACTIVE with progress bumps
        const name = upload.name!
        let latest = upload;
        const start = Date.now();
        let progress = 35;
        while (latest.state !== "ACTIVE") {
          if (latest.state === "FAILED") throw new Error(latest.error?.message || "File processing failed");
          await new Promise((r) => setTimeout(r, 1200));
          progress = Math.min(55, progress + 4);
          writeEvent(controller, { phase: "processing", progress });
          latest = await ai.files.get({ name });
          if (Date.now() - start > 240000) throw new Error("Timed out waiting for ACTIVE");
        }

        writeEvent(controller, { phase: "generate", progress: 60 });
        const mode = (fd.get("mode") as string) || "detail";
        const promptDetail = `あなたは動画解析の専門家です。以下の構造で出力してください：

## 概要
[ファイル名と動画全体の内容を2-3行で要約]

## 所要時間
[動画の長さ]

## 業務推察
[作業者が画面のどの部分を見ているか、何を確認しようとしているかを推察して記述]

## 業務詳細
[他の人が同じ作業を再現できるよう、以下の形式で詳細に記述]

### ステップ1: [ステップ名] 【所要時間xx分】
- 具体的な操作1
- 具体的な操作2
- 具体的な操作3

**業務推察:** [このステップで作業者が何を確認・検証しようとしているかを推察]

### ステップ2: [ステップ名] 【所要時間xx分】
- 具体的な操作1
- 具体的な操作2

**業務推察:** [このステップで作業者が何を確認・検証しようとしているかを推察]

[必要に応じてステップを追加]

業務詳細では、各ステップの所要時間を【所要時間xx分】の形式で記載し、各ステップの後に**業務推察:**として作業者の意図を推察してください。操作詳細では、ボタン名、メニュー名、入力値、クリック位置、キーボード操作、画面遷移など、第三者が同じ作業を完全に再現できる粒度で記述してください。`;
        const promptSummary = `あなたは動画解析の専門家です。以下の構造で簡潔に出力してください（全体で500〜800字程度）：

## 概要
[ファイル名と動画全体の内容を1-2行で要約]

## 重要ポイント
- [最重要の操作・確認 3-6個の箇条書き]

## 所要時間
[動画の長さ]

## 次のアクション
- [視聴後に取るべきアクション 2-3個]
`;
        const prompt = mode === "summary" ? promptSummary : promptDetail;

        const g = await ai.models.generateContentStream({
          model: "gemini-2.5-flash-lite",
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { fileData: { mimeType: latest.mimeType!, fileUri: latest.uri! } },
              ],
            },
          ],
          config: { temperature: 0.4, maxOutputTokens: 8000 },
        });

        let acc = "";
        let usageMetadata: any = null;
        for await (const chunk of g) {
          const t = chunk.text ?? undefined;
          if (t) {
            acc += t;
            writeEvent(controller, { phase: "stream", progress: 60 + Math.min(35, Math.floor(acc.length / 500)), delta: t });
          }
          // Capture usage metadata from the last chunk
          if (chunk.usageMetadata) {
            usageMetadata = chunk.usageMetadata;
          }
        }
        // 'acc' holds the streamed markdown text
        writeEvent(controller, { 
          phase: "done", 
          progress: 100, 
          text: acc,
          tokens: usageMetadata ? {
            inputTokens: usageMetadata.promptTokenCount || 0,
            outputTokens: usageMetadata.candidatesTokenCount || 0,
            totalTokens: usageMetadata.totalTokenCount || 0
          } : null
        });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "internal error";
        writeEvent(controller, { error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

