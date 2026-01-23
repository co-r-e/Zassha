import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { SEGMENT_LEN_SEC, UPLOAD_PROGRESS_MAX } from "@/config";
import type { StreamEvent, ProgressEvent, DeltaEvent, DoneEvent, ErrorEvent } from "@/types/progress";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function send(controller: ReadableStreamDefaultController, evt: StreamEvent) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(evt) + "\n"));
}

type NormalizedError = { code: string; message: string };

function tryParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {}
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(input.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function extractRetryAfterSec(details: unknown, message: string): number | null {
  const fromMessage = message.match(/retry in\s*([0-9.]+)\s*s/i);
  if (fromMessage && fromMessage[1]) {
    const sec = Number.parseFloat(fromMessage[1]);
    if (Number.isFinite(sec)) return Math.max(1, Math.ceil(sec));
  }
  if (Array.isArray(details)) {
    for (const d of details) {
      if (!d || typeof d !== "object") continue;
      const obj = d as { ["@type"]?: unknown; retryDelay?: unknown };
      if (typeof obj.retryDelay === "string") {
        const m = obj.retryDelay.match(/([0-9.]+)s/);
        if (m && m[1]) {
          const sec = Number.parseFloat(m[1]);
          if (Number.isFinite(sec)) return Math.max(1, Math.ceil(sec));
        }
      }
    }
  }
  return null;
}

function normalizeGeminiError(err: unknown, lang: "ja" | "en"): NormalizedError {
  const raw = err instanceof Error ? err.message : String(err);
  const parsed = tryParseJson(raw);
  const top = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const errObj = top && typeof top.error === "object" && top.error !== null ? (top.error as Record<string, unknown>) : top;
  const status = errObj?.status;
  const code = errObj?.code;
  const codeNum = typeof code === "number" ? code : Number.parseInt(String(code), 10);
  const message = typeof errObj?.message === "string" ? errObj.message : raw;
  const details = errObj?.details;
  const retryAfterSec = extractRetryAfterSec(details, message);
  const lower = message.toLowerCase();
  const isQuota = status === "RESOURCE_EXHAUSTED"
    || codeNum === 429
    || lower.includes("quota")
    || lower.includes("rate limit")
    || lower.includes("too many requests")
    || lower.includes("resource_exhausted");

  if (isQuota) {
    const retryText = retryAfterSec
      ? (lang === "ja" ? `約${retryAfterSec}秒待って再試行してください。` : `Please wait about ${retryAfterSec}s and try again.`)
      : (lang === "ja" ? "しばらく待って再試行してください。" : "Please wait a bit and try again.");
    const freeTierHint = /free[_ ]?tier|FreeTier|limit:\s*0/i.test(message)
      ? (lang === "ja" ? "無料枠では利用できないモデルの可能性があります。" : "This model may not be available on the free tier.")
      : "";
    const tail = lang === "ja"
      ? "プラン/課金状況を確認するか、リクエスト量を減らしてください。"
      : "Check your plan/billing or reduce requests.";
    return {
      code: "GEMINI_QUOTA_EXCEEDED",
      message: [lang === "ja" ? "Gemini API のクォータ上限に達しました。" : "Gemini API quota exceeded.", retryText, tail, freeTierHint].filter(Boolean).join(" "),
    };
  }

  if (message.includes("Timed out waiting for ACTIVE")) {
    return {
      code: "GEMINI_FILE_TIMEOUT",
      message: lang === "ja"
        ? "ファイル処理の待機がタイムアウトしました。しばらく待って再試行してください。"
        : "Timed out while waiting for the file to become active. Please try again later.",
    };
  }

  if (message.includes("File processing failed")) {
    return {
      code: "GEMINI_FILE_FAILED",
      message: lang === "ja"
        ? "ファイル処理に失敗しました。形式や内容を変えて再試行してください。"
        : "File processing failed. Please try a different file or retry later.",
    };
  }

  const fallback = lang === "ja"
    ? "処理に失敗しました。時間をおいて再試行してください。"
    : "Processing failed. Please try again later.";
  return { code: "INTERNAL", message: fallback };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set" }), { status: 500 });
  }
  const fd = await req.formData();
  const file = fd.get("file");
  const uploadId = (fd.get("uploadId") as string | null) || null;
  const fileName = (fd.get("fileName") as string | null) || "video.mp4";
  const hint = (fd.get("hint") as string | null) || "";
  const mode = (fd.get("mode") as string) || "detail";
  const lang = (fd.get("lang") as string) === "ja" ? "ja" : "en";
  if (!(file instanceof File) && !uploadId) {
    return new Response(JSON.stringify({ error: "file or uploadId is required" }), { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { kind: "progress", phase: "upload", progress: 10, message: "uploading" } as ProgressEvent);
        // Prepare local file handle
        let localPath: string | null = null;
        if (uploadId) {
          const dir = path.join(os.tmpdir(), "zassha_uploads", uploadId);
          const ext = path.extname(fileName) || ".mp4";
          localPath = path.join(dir, "final" + ext);
        } else {
          // persist in tmp for potential segmentation
          const f = file as File;
          const buf = new Uint8Array(await f.arrayBuffer());
          const tmp = path.join(os.tmpdir(), `zassha_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(f.name) || ".mp4"}`);
          await fs.writeFile(tmp, buf);
          localPath = tmp;
        }

        const segments = SEGMENT_LEN_SEC > 0 ? await segmentVideo(localPath!, SEGMENT_LEN_SEC) : [localPath!];
        let acc = "";
        let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null = null;

        let prevSummary = "";
        for (let i = 0; i < segments.length; i++) {
          send(controller, { kind: "progress", phase: "generate", progress: 60 + Math.round((i / Math.max(1, segments.length)) * 35), message: `segment ${i + 1}/${segments.length}`, segmentIndex: i, segmentTotal: segments.length } as ProgressEvent);
          const segPath = segments[i];
          const segExt = path.extname(segPath) || path.extname(localPath!) || ".mp4";
          const segName = `${path.basename(localPath!, path.extname(localPath!))}.seg${i}${segExt}`;
          const upload = await ai.files.upload({ file: await toNodeFile(segPath, segName) });
          // wait ACTIVE
          const name = upload.name!;
          let latest = upload;
          const startWait = Date.now();
          while (latest.state !== "ACTIVE") {
            if (latest.state === "FAILED") throw new Error(latest.error?.message || "File processing failed");
            await new Promise((r) => setTimeout(r, 800));
            latest = await ai.files.get({ name });
            if (Date.now() - startWait > 120000) throw new Error("Timed out waiting for ACTIVE");
          }
          const segPrefixJa = prevSummary ? `前セグメントの要約:\n${prevSummary}\n\n` : "";
          const segPrefixEn = prevSummary ? `Previous segment summary:\n${prevSummary}\n\n` : "";
          const base = buildPrompts(hint);
          const segPrompt = mode === "summary"
            ? (lang === "ja" ? `${segPrefixJa}${base.summary.ja}` : `${segPrefixEn}${base.summary.en}`)
            : (lang === "ja" ? `${segPrefixJa}${base.detail.ja}` : `${segPrefixEn}${base.detail.en}`);

          const g = await ai.models.generateContentStream({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: segPrompt }, { fileData: { mimeType: latest.mimeType!, fileUri: latest.uri! } }] }],
            config: { temperature: 0.4, maxOutputTokens: 4000 },
          });
          for await (const chunk of g as AsyncIterable<{ text?: string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }>) {
            const t = chunk.text ?? undefined;
            if (t) {
              acc += t;
              send(controller, { kind: "delta", phase: "stream", progress: 60 + Math.min(35, Math.floor(acc.length / 500)), delta: t, segmentIndex: i, segmentTotal: segments.length } as DeltaEvent);
            }
            if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
          }
          // very simple summary for next segment bridging
          prevSummary = summarizeForBridge(acc, lang);
        }
        // segmentation path already streamed into acc above

        // 'acc' holds the streamed markdown text
        send(controller, { kind: "done", phase: "done", progress: 100, text: acc, tokens: usageMetadata ? {
          inputTokens: usageMetadata.promptTokenCount || 0,
          outputTokens: usageMetadata.candidatesTokenCount || 0,
          totalTokens: usageMetadata.totalTokenCount || 0
        } : null } as DoneEvent);
        controller.close();
      } catch (err) {
        const normalized = normalizeGeminiError(err, lang);
        console.error("[explain/stream] error", err);
        send(controller, { kind: "error", phase: "error", progress: UPLOAD_PROGRESS_MAX, error: normalized } as ErrorEvent);
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

async function toNodeFile(p: string, name: string) {
  const buf = await fs.readFile(p);
  // Node 18+ has File in global
  return new File([new Uint8Array(buf)], name, { type: guessVideoMime(name) });
}

function guessVideoMime(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    case ".m4v":
      return "video/x-m4v";
    case ".mp4":
      return "video/mp4";
    default:
      return "video/mp4";
  }
}

async function segmentVideo(inputPath: string, segmentLenSec: number): Promise<string[]> {
  // Try to copy-split by segment_time; fallback to single file on failure
  const outDir = path.join(path.dirname(inputPath), path.basename(inputPath) + "_segs");
  await fs.mkdir(outDir, { recursive: true });
  const pattern = path.join(outDir, "part_%03d.mp4");
  const args = ["-hide_banner", "-y", "-i", inputPath, "-c", "copy", "-f", "segment", "-segment_time", String(segmentLenSec), "-reset_timestamps", "1", pattern];
  const ok = await new Promise<boolean>((resolve) => {
    const ps = spawn("ffmpeg", args);
    ps.on("error", () => resolve(false));
    ps.on("exit", (code) => resolve(code === 0));
  });
  if (!ok) return [inputPath];
  const files = (await fs.readdir(outDir)).filter((f) => f.startsWith("part_")).sort();
  if (!files.length) return [inputPath];
  return files.map((f) => path.join(outDir, f));
}

function summarizeForBridge(markdown: string, lang: "ja" | "en") {
  const cap = 400;
  const txt = markdown.replace(/```[\s\S]*?```/g, "").replace(/[#*_>`-]/g, "").replace(/\s+/g, " ").trim();
  return (lang === "ja" ? "前要約: " : "Prev: ") + txt.slice(-cap);
}

function buildPrompts(hint: string) {
  const promptDetailJa = `あなたは動画解析の専門家です。以下の構造で出力してください：

参考情報（任意）: ${hint ? hint : "(特になし)"}

## 概要
[ファイル名と動画全体の内容を2-3行で要約]

## 所要時間
[動画の長さ]

## 解説
[作業者が画面のどの部分を見ているか、何を確認しようとしているかを推察して記述]

## 業務詳細
[他の人が同じ作業を再現できるよう、以下の形式で詳細に記述]

### ステップ1: [ステップ名] 【所要時間xx分】
**タイムスタンプ:** [動画上の該当箇所（例: 00:45 または 00:45–01:20）]
**使用ツール:** [動画の内容から推察した具体的なツール名。例: Google Chrome / Excel / VS Code / Slack / Jira / GitHub / Terminal / Finder / Figma など製品名やSaaS名]
- 具体的な操作1
- 具体的な操作2
- 具体的な操作3

**解説:** [このステップで作業者が何を確認・検証しようとしているかを推察]

### ステップ2: [ステップ名] 【所要時間xx分】
**タイムスタンプ:** [動画上の該当箇所（例: 02:10 または 01:20–02:00）]
**使用ツール:** [動画の内容から推察した具体的なツール名]
- 具体的な操作1
- 具体的な操作2

**解説:** [このステップで作業者が何を確認・検証しようとしているかを推察]

[必要に応じてステップを追加]

業務詳細では、各ステップの所要時間を【所要時間xx分】の形式で記載し、各ステップで**タイムスタンプ**（単一時刻または開始–終了の範囲）と**使用ツール**を明記し、各ステップの後に**解説:**として作業者の意図を推察してください。操作詳細では、ボタン名、メニュー名、入力値、クリック位置、キーボード操作、画面遷移など、第三者が同じ作業を完全に再現できる粒度で記述してください。`;
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
**Timestamp:** [Relevant time in the video (e.g., 00:45 or 00:45–01:20)]
**Used Tool:** [Specific tool name inferred from the video, e.g., Google Chrome / Excel / VS Code / Slack / Jira / GitHub / Terminal / Finder / Figma]
- Concrete operation 1
- Concrete operation 2
- Concrete operation 3

**Business Inference:** [What the operator intends to check/verify in this step]

### Step 2: [Step name] [Duration xx min]
**Timestamp:** [Relevant time in the video (e.g., 02:10 or 01:20–02:00)]
**Used Tool:** [Specific tool name]
- Concrete operation 1
- Concrete operation 2

**Business Inference:** [What the operator intends in this step]

[Add more steps as needed]

In Business Details, write each step's duration as [Duration xx min], always include a **Timestamp** (single time or start–end range) and **Used Tool** (use specific product names when possible), and add **Business Inference:** after each step. For operations, include button/menu names, input values, click targets, keyboard actions, screen transitions, etc., at a granularity that allows exact reproduction.`;
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

**解説:** [このステップの目的・意図を1行で]

### ステップ2: [ステップ名] 【所要時間xx分】
**使用ツール:** [動画の内容から推察した具体的なツール名]
- 代表的な操作1（簡潔）
- 代表的な操作2（簡潔）

**解説:** [このステップの目的・意図を1行で]

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
  return {
    detail: { ja: promptDetailJa, en: promptDetailEn },
    summary: { ja: promptSummaryJa, en: promptSummaryEn },
  };
}
