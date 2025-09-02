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
  const hint = (fd.get("hint") as string | null) || "";
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
        const lang = (fd.get("lang") as string) === "ja" ? "ja" : "en";
        const promptDetailJa = `あなたは動画解析の専門家です。以下の構造で出力してください：

参考情報（任意）: ${hint ? hint : "(特になし)"}

## 概要
[ファイル名と動画全体の内容を2-3行で要約]

## 所要時間
[動画の長さ]

## 業務推察
[作業者が画面のどの部分を見ているか、何を確認しようとしているかを推察して記述]

## 業務詳細
[他の人が同じ作業を再現できるよう、以下の形式で詳細に記述]

### ステップ1: [ステップ名] 【所要時間xx分】
**使用ツール:** [動画の内容から推察した具体的なツール名。例: Google Chrome / Excel / VS Code / Slack / Jira / GitHub / Terminal / Finder / Figma など製品名やSaaS名]
- 具体的な操作1
- 具体的な操作2
- 具体的な操作3

**業務推察:** [このステップで作業者が何を確認・検証しようとしているかを推察]

### ステップ2: [ステップ名] 【所要時間xx分】
**使用ツール:** [動画の内容から推察した具体的なツール名]
- 具体的な操作1
- 具体的な操作2

**業務推察:** [このステップで作業者が何を確認・検証しようとしているかを推察]

[必要に応じてステップを追加]

業務詳細では、各ステップの所要時間を【所要時間xx分】の形式で記載し、各ステップで**使用ツール**を必ず明記し（できる限り具体的な製品名）、各ステップの後に**業務推察:**として作業者の意図を推察してください。操作詳細では、ボタン名、メニュー名、入力値、クリック位置、キーボード操作、画面遷移など、第三者が同じ作業を完全に再現できる粒度で記述してください。`;
        const promptDetailEn = `You are an expert at analyzing screen recordings. Output in the following structure.

LANGUAGE POLICY: Output only in English. If any on-screen text, UI labels, or speech are in Japanese or any non-English language, translate all content into natural English. Do not include non-English text unless essential for clarity.

Reference (optional): ${hint ? hint : "(none)"}

## Overview
[Summarize the file name and the whole video in 2–3 lines]

## Duration
[Length of the video]

## Business Inference
[Infer what the operator is looking at and trying to verify]

## Business Details
[Describe so that others can reproduce the same work exactly]

### Step 1: [Step name] [Duration xx min]
**Used Tool:** [Specific tool name inferred from the video, e.g., Google Chrome / Excel / VS Code / Slack / Jira / GitHub / Terminal / Finder / Figma]
- Concrete operation 1
- Concrete operation 2
- Concrete operation 3

**Business Inference:** [What the operator intends to check/verify in this step]

### Step 2: [Step name] [Duration xx min]
**Used Tool:** [Specific tool name]
- Concrete operation 1
- Concrete operation 2

**Business Inference:** [What the operator intends in this step]

[Add more steps as needed]

In Business Details, write each step's duration as [Duration xx min], always include **Used Tool** (use specific product names when possible), and add **Business Inference:** after each step. For operations, include button/menu names, input values, click targets, keyboard actions, screen transitions, etc., at a granularity that allows exact reproduction.`;
        const promptSummaryJa = `あなたは動画解析の専門家です。以下の構造で簡潔に出力してください（全体で500〜800字程度）：

参考情報（任意）: ${hint ? hint : "(特になし)"}

## 概要
[ファイル名と動画全体の内容を1-2行で要約]

## 重要ポイント
- [最重要の操作・確認 3-6個の箇条書き]

## 所要時間
[動画の長さ]

## 次のアクション
- [視聴後に取るべきアクション 2-3個]

## 業務詳細（簡略）
[主要なステップを2〜4つ、各ステップは以下の形式で簡潔に記述。各ステップの見出しに【所要時間xx分】を含めてください]

### ステップ1: [ステップ名] 【所要時間xx分】
**使用ツール:** [動画の内容から推察した具体的なツール名]
- 代表的な操作1（簡潔）
- 代表的な操作2（簡潔）

**業務推察:** [このステップの目的・意図を1行で]

### ステップ2: [ステップ名] 【所要時間xx分】
**使用ツール:** [動画の内容から推察した具体的なツール名]
- 代表的な操作1（簡潔）
- 代表的な操作2（簡潔）

**業務推察:** [このステップの目的・意図を1行で]

[必要に応じてステップを追加（最大4つまで）]
`;
        const promptSummaryEn = `You are an expert at analyzing screen recordings. Output concisely in the structure below (about 500–800 chars total).

LANGUAGE POLICY: Output only in English. If any on-screen text, UI labels, or speech are in Japanese or any non-English language, translate all content into natural English. Do not include non-English text unless essential for clarity.

Reference (optional): ${hint ? hint : "(none)"}

## Overview
[Summarize the file name and the whole video in 1–2 lines]

## Key Points
- [3–6 bullet points of the most important operations/checks]

## Duration
[Length of the video]

## Next Actions
- [2–3 actions to take after watching]

## Business Details (Brief)
[List 2–4 main steps, each as below. Include [Duration xx min] in each step heading.]

### Step 1: [Step name] [Duration xx min]
**Used Tool:** [Specific tool name inferred from the video]
- Representative operation 1 (concise)
- Representative operation 2 (concise)

**Business Inference:** [One-line purpose/intention of the step]

### Step 2: [Step name] [Duration xx min]
**Used Tool:** [Specific tool name]
- Representative operation 1 (concise)
- Representative operation 2 (concise)

**Business Inference:** [One-line purpose/intention]

[Add more steps if needed (max 4)]
`;
        const prompt = mode === "summary"
          ? (lang === "ja" ? promptSummaryJa : promptSummaryEn)
          : (lang === "ja" ? promptDetailJa : promptDetailEn);

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
        let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null = null;
        for await (const chunk of g) {
          const t = chunk.text ?? undefined;
          if (t) {
            acc += t;
            writeEvent(controller, { phase: "stream", progress: 60 + Math.min(35, Math.floor(acc.length / 500)), delta: t });
          }
          // Capture usage metadata from the last chunk
          if (chunk.usageMetadata) {
            usageMetadata = chunk.usageMetadata as {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              totalTokenCount?: number;
            };
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
