import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import os from "node:os";
import { SEGMENT_LEN_SEC, UPLOAD_PROGRESS_MAX } from "@/config";
import { ANALYSIS_RESPONSE_JSON_SCHEMA, summarizeStructuredResultForBridge } from "@/lib/analysis-schema";
import type { ParsedContent } from "@/lib/parse-content";
import { mergeParsedContents, normalizeParsedContent, shiftParsedContent } from "@/lib/parse-content";
import type { StreamEvent, ProgressEvent, DoneEvent, ErrorEvent } from "@/types/progress";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TEMPERATURE = Number(process.env.GEMINI_TEMPERATURE) || 0.2;
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 4000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Lang = "ja" | "en";
type AnalysisMode = "summary" | "detail";
type UsageSummary = { inputTokens: number; outputTokens: number; totalTokens: number };
type UsageLike = { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null | undefined;
type VideoSegment = { path: string; offsetSec: number };

function send(controller: ReadableStreamDefaultController, evt: StreamEvent) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(evt) + "\n"));
}

function sendProgress(
  controller: ReadableStreamDefaultController,
  progress: number,
  phase: ProgressEvent["phase"],
  message?: string,
  meta?: Pick<ProgressEvent, "segmentIndex" | "segmentTotal">
) {
  send(controller, {
    kind: "progress",
    phase,
    progress,
    message,
    ...meta,
  } satisfies ProgressEvent);
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
  if (fromMessage?.[1]) {
    const sec = Number.parseFloat(fromMessage[1]);
    if (Number.isFinite(sec)) return Math.max(1, Math.ceil(sec));
  }
  if (Array.isArray(details)) {
    for (const d of details) {
      if (!d || typeof d !== "object") continue;
      const obj = d as { retryDelay?: unknown };
      if (typeof obj.retryDelay === "string") {
        const m = obj.retryDelay.match(/([0-9.]+)s/);
        if (m?.[1]) {
          const sec = Number.parseFloat(m[1]);
          if (Number.isFinite(sec)) return Math.max(1, Math.ceil(sec));
        }
      }
    }
  }
  return null;
}

function normalizeGeminiError(err: unknown, lang: Lang): NormalizedError {
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

  if (message.includes("Invalid structured response")) {
    return {
      code: "INVALID_STRUCTURED_RESPONSE",
      message: lang === "ja"
        ? "AI の構造化応答を解釈できませんでした。再試行してください。"
        : "The AI response could not be interpreted as structured data. Please retry.",
    };
  }

  const fallback = lang === "ja"
    ? "処理に失敗しました。時間をおいて再試行してください。"
    : "Processing failed. Please try again later.";
  return { code: "INTERNAL", message: fallback };
}

function toUsageSummary(usage: UsageLike): UsageSummary {
  return {
    inputTokens: usage?.promptTokenCount || 0,
    outputTokens: usage?.candidatesTokenCount || 0,
    totalTokens: usage?.totalTokenCount || 0,
  };
}

function addUsage(total: UsageSummary, usage: UsageLike) {
  const next = toUsageSummary(usage);
  total.inputTokens += next.inputTokens;
  total.outputTokens += next.outputTokens;
  total.totalTokens += next.totalTokens;
}

function stageMessage(
  lang: Lang,
  key:
    | "prepare"
    | "segmenting"
    | "uploadingToGemini"
    | "waitingForGemini"
    | "analyzingSegment"
    | "combining"
    | "completed",
  meta?: { segmentIndex?: number; segmentTotal?: number }
) {
  const current = typeof meta?.segmentIndex === "number" ? meta.segmentIndex + 1 : undefined;
  const total = meta?.segmentTotal;
  switch (key) {
    case "prepare":
      return lang === "ja" ? "解析の準備をしています" : "Preparing analysis";
    case "segmenting":
      return lang === "ja" ? "動画を分割しています" : "Segmenting the video";
    case "uploadingToGemini":
      return current && total
        ? (lang === "ja" ? `セグメント ${current}/${total} を Gemini に送信中` : `Uploading segment ${current}/${total} to Gemini`)
        : (lang === "ja" ? "Gemini に動画を送信中" : "Uploading video to Gemini");
    case "waitingForGemini":
      return current && total
        ? (lang === "ja" ? `セグメント ${current}/${total} の処理待機中` : `Waiting for segment ${current}/${total} to become active`)
        : (lang === "ja" ? "ファイル処理待機中" : "Waiting for the file to become active");
    case "analyzingSegment":
      return current && total
        ? (lang === "ja" ? `セグメント ${current}/${total} を解析中` : `Analyzing segment ${current}/${total}`)
        : (lang === "ja" ? "解析中" : "Analyzing");
    case "combining":
      return lang === "ja" ? "セグメント結果を統合しています" : "Combining segment results";
    case "completed":
      return lang === "ja" ? "解析が完了しました" : "Analysis completed";
  }
}

function buildAnalysisPrompt({
  hint,
  mode,
  lang,
  bridgeSummary,
}: {
  hint: string;
  mode: AnalysisMode;
  lang: Lang;
  bridgeSummary?: string;
}) {
  const detailClause = mode === "summary"
    ? (lang === "ja"
      ? "businessDetails は 2〜4 個の主要ステップに絞り、operations も各ステップ 2〜4 個の代表操作だけにしてください。"
      : "Limit businessDetails to 2-4 main steps and keep 2-4 representative operations per step.")
    : (lang === "ja"
      ? "businessDetails は可能な限り完全にし、再現に必要な操作を順序どおり細かく列挙してください。"
      : "Make businessDetails as complete as possible and list reproducible operations in order.");

  if (lang === "ja") {
    return [
      "あなたは画面録画を解析して再現可能な手順に変換する専門家です。",
      "出力は必ず JSON のみとし、Markdown や説明文やコードフェンスは一切出力しないでください。",
      `参考情報: ${hint || "(特になし)"}`,
      bridgeSummary ? `${bridgeSummary}` : "",
      "overview: 動画全体の要約を 2〜3 文で記述。",
      "duration: 分かる場合のみ短い文字列で記述。分からなければ空文字でもよい。",
      "businessInference: 作業者の目的、確認観点、意図を簡潔に記述。",
      "keyPoints: 重要な操作や確認点を 3〜6 件。",
      "nextActions: 視聴後に取りうるアクションを 0〜3 件。",
      "businessDetails: ステップ配列。stepName / stepTool / stepInference / stepTimestamp / operations を埋める。",
      "stepTimestamp は `00:45` または `00:45-01:20` の形式。",
      "opTimestamp は `[00:45]` または `[00:45-01:20]` の形式。",
      "timeStartSec / timeEndSec / opStartSec / opEndSec / opTimeSec は自信がある場合のみ数値で入れる。",
      "タイムスタンプに自信がない場合は関連フィールドを省略し、推測を埋めないこと。",
      detailClause,
      "使用ツールは Google Chrome / Excel / VS Code / Slack など具体的な製品名で記述してください。",
      "操作文は、ボタン名、メニュー名、入力値、クリック対象、画面遷移が分かる粒度にしてください。",
    ].filter(Boolean).join("\n");
  }

  return [
    "You are an expert at turning screen recordings into reproducible workflows.",
    "Return JSON only. Do not output markdown, explanations, or code fences.",
    "LANGUAGE POLICY: Output only in English. Translate non-English UI text into natural English when useful.",
    `Reference: ${hint || "(none)"}`,
    bridgeSummary || "",
    "overview: summarize the whole video in 2-3 sentences.",
    "duration: short human-readable duration if known, otherwise an empty string is acceptable.",
    "businessInference: explain the operator's goal, validation points, and intent.",
    "keyPoints: 3-6 important operations or checks.",
    "nextActions: 0-3 follow-up actions after watching.",
    "businessDetails: ordered step array with stepName, stepTool, stepInference, stepTimestamp, and operations.",
    "stepTimestamp format: `00:45` or `00:45-01:20`.",
    "opTimestamp format: `[00:45]` or `[00:45-01:20]`.",
    "Populate timeStartSec / timeEndSec / opStartSec / opEndSec / opTimeSec only when confident.",
    "If timing is uncertain, omit the timing fields instead of guessing.",
    detailClause,
    "Use specific product names for tools whenever possible.",
    "Write operations at a level where another person could repeat the workflow exactly.",
  ].filter(Boolean).join("\n");
}

function buildMergePrompt(results: ParsedContent[], hint: string, mode: AnalysisMode, lang: Lang) {
  const detailClause = mode === "summary"
    ? (lang === "ja"
      ? "最終結果では主要ステップだけを 2〜4 個程度に整理してください。"
      : "Keep the final result to roughly 2-4 main steps.")
    : (lang === "ja"
      ? "最終結果ではステップを削りすぎず、再現に必要な操作を残してください。"
      : "Do not over-compress; keep the operations needed for reproduction.");

  const payload = JSON.stringify(results);
  if (lang === "ja") {
    return [
      "以下は各セグメントを解析した JSON です。これらを 1 つの最終 JSON に統合してください。",
      "出力は必ず JSON のみとし、説明文や Markdown は出力しないでください。",
      `参考情報: ${hint || "(特になし)"}`,
      "ルール:",
      "- ステップ順序は動画の時系列順を保つ。",
      "- 重複または連続する同種ステップは必要に応じて統合する。",
      "- タイムスタンプは可能な限り保持し、絶対時刻のまま返す。",
      "- overview / businessInference / keyPoints / nextActions は全体を要約して再生成してよい。",
      detailClause,
      payload,
    ].join("\n");
  }

  return [
    "Below are JSON analyses for each segment. Combine them into one final JSON result.",
    "Return JSON only. Do not output markdown or explanations.",
    `Reference: ${hint || "(none)"}`,
    "Rules:",
    "- Preserve chronological order.",
    "- Merge duplicate or consecutive equivalent steps when appropriate.",
    "- Keep timestamps as absolute times whenever available.",
    "- You may rewrite overview, businessInference, keyPoints, and nextActions to summarize the whole video.",
    detailClause,
    payload,
  ].join("\n");
}

async function streamJsonResponse({
  ai,
  controller,
  message,
  progressStart,
  progressEnd,
  contents,
}: {
  ai: GoogleGenAI;
  controller: ReadableStreamDefaultController;
  message: string;
  progressStart: number;
  progressEnd: number;
  contents: unknown;
}) {
  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: contents as never,
    config: {
      temperature: GEMINI_TEMPERATURE,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      responseJsonSchema: ANALYSIS_RESPONSE_JSON_SCHEMA,
    },
  });

  let text = "";
  let usage: UsageLike = null;
  let lastProgress = progressStart;
  for await (const chunk of response as AsyncIterable<{ text?: string; usageMetadata?: UsageLike }>) {
    const delta = chunk.text ?? "";
    if (delta) {
      text += delta;
      const span = Math.max(1, progressEnd - progressStart);
      const next = Math.min(progressEnd, progressStart + Math.max(1, Math.floor(text.length / 180)));
      if (next > lastProgress) {
        sendProgress(controller, next, "generate", message);
        lastProgress = next;
      } else if (span === 1 && lastProgress < progressEnd) {
        sendProgress(controller, progressEnd, "generate", message);
        lastProgress = progressEnd;
      }
    }
    if (chunk.usageMetadata) usage = chunk.usageMetadata;
  }
  if (lastProgress < progressEnd) sendProgress(controller, progressEnd, "generate", message);
  return { text, usage };
}

function parseStructuredResult(text: string, lang: Lang): ParsedContent {
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error("Invalid structured response");
  return normalizeParsedContent(parsed, lang);
}

async function waitUntilActive(ai: GoogleGenAI, name: string) {
  let latest = await ai.files.get({ name });
  const startWait = Date.now();
  while (latest.state !== "ACTIVE") {
    if (latest.state === "FAILED") throw new Error(latest.error?.message || "File processing failed");
    await new Promise((resolve) => setTimeout(resolve, 800));
    latest = await ai.files.get({ name });
    if (Date.now() - startWait > 120000) throw new Error("Timed out waiting for ACTIVE");
  }
  return latest;
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
  const mode = (fd.get("mode") as AnalysisMode) || "detail";
  const lang = (fd.get("lang") as string) === "ja" ? "ja" : "en";

  if (!(file instanceof File) && !uploadId) {
    return new Response(JSON.stringify({ error: "file or uploadId is required" }), { status: 400 });
  }
  if (uploadId && !UUID_RE.test(uploadId)) {
    return new Response(JSON.stringify({ error: "invalid uploadId" }), { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      let localPath: string | null = null;
      try {
        sendProgress(controller, 22, "processing", stageMessage(lang, "prepare"));

        if (uploadId) {
          const dir = path.join(os.tmpdir(), "zassha_uploads", uploadId);
          const ext = path.extname(fileName) || ".mp4";
          localPath = path.join(dir, "final" + ext);
        } else {
          const f = file as File;
          const buf = new Uint8Array(await f.arrayBuffer());
          const tmp = path.join(
            os.tmpdir(),
            `zassha_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(f.name) || ".mp4"}`
          );
          await fs.writeFile(tmp, buf);
          localPath = tmp;
        }

        sendProgress(
          controller,
          SEGMENT_LEN_SEC > 0 ? 28 : 30,
          "processing",
          SEGMENT_LEN_SEC > 0 ? stageMessage(lang, "segmenting") : stageMessage(lang, "prepare")
        );
        const segments = SEGMENT_LEN_SEC > 0
          ? await segmentVideo(localPath!, SEGMENT_LEN_SEC)
          : [{ path: localPath!, offsetSec: 0 }];

        const tokenSummary: UsageSummary = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        const segmentResults: ParsedContent[] = [];
        let prevSummary = "";

        for (let i = 0; i < segments.length; i++) {
          const meta = { segmentIndex: i, segmentTotal: segments.length };
          const baseProgress = 32 + Math.round((i / Math.max(1, segments.length)) * 48);
          sendProgress(controller, baseProgress, "upload", stageMessage(lang, "uploadingToGemini", meta), meta);

          const segment = segments[i];
          const segPath = segment.path;
          const segExt = path.extname(segPath) || path.extname(localPath!) || ".mp4";
          const segName = `${path.basename(localPath!, path.extname(localPath!))}.seg${i}${segExt}`;
          const upload = await ai.files.upload({ file: await toNodeFile(segPath, segName) });

          sendProgress(controller, baseProgress + 4, "processing", stageMessage(lang, "waitingForGemini", meta), meta);
          const activeFile = await waitUntilActive(ai, upload.name!);

          const prompt = buildAnalysisPrompt({
            hint,
            mode,
            lang,
            bridgeSummary: prevSummary,
          });

          const { text, usage } = await streamJsonResponse({
            ai,
            controller,
            message: stageMessage(lang, "analyzingSegment", meta),
            progressStart: baseProgress + 8,
            progressEnd: Math.min(88, baseProgress + 18),
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { fileData: { mimeType: activeFile.mimeType!, fileUri: activeFile.uri! } },
              ],
            }],
          });
          addUsage(tokenSummary, usage);

          const parsed = parseStructuredResult(text, lang);
          const shifted = shiftParsedContent(parsed, segment.offsetSec);
          segmentResults.push(shifted);
          prevSummary = summarizeStructuredResultForBridge(shifted, lang);
        }

        let result = segmentResults[0] || { overview: "", businessDetails: [] };
        if (segmentResults.length > 1) {
          sendProgress(controller, 90, "processing", stageMessage(lang, "combining"));
          try {
            const { text, usage } = await streamJsonResponse({
              ai,
              controller,
              message: stageMessage(lang, "combining"),
              progressStart: 92,
              progressEnd: 98,
              contents: buildMergePrompt(segmentResults, hint, mode, lang),
            });
            addUsage(tokenSummary, usage);
            result = parseStructuredResult(text, lang);
          } catch (mergeError) {
            console.warn("[explain/stream] structured merge failed, falling back to local merge", mergeError);
            result = mergeParsedContents(segmentResults, lang);
          }
        }

        sendProgress(controller, 99, "done", stageMessage(lang, "completed"));
        send(controller, {
          kind: "done",
          phase: "done",
          progress: 100,
          result,
          tokens: tokenSummary,
        } satisfies DoneEvent);
        controller.close();
      } catch (err) {
        const normalized = normalizeGeminiError(err, lang);
        console.error("[explain/stream] error", err);
        send(controller, {
          kind: "error",
          phase: "error",
          progress: UPLOAD_PROGRESS_MAX,
          error: normalized,
        } satisfies ErrorEvent);
        controller.close();
      } finally {
        try {
          if (uploadId) {
            await fs.rm(path.join(os.tmpdir(), "zassha_uploads", uploadId), { recursive: true, force: true });
          } else if (localPath) {
            await fs.rm(localPath, { force: true });
          }
          if (localPath) {
            await fs.rm(`${localPath}_segs`, { recursive: true, force: true }).catch(() => {});
          }
        } catch {
          // ignore cleanup errors
        }
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

async function segmentVideo(inputPath: string, segmentLenSec: number): Promise<VideoSegment[]> {
  const outDir = path.join(path.dirname(inputPath), path.basename(inputPath) + "_segs");
  await fs.mkdir(outDir, { recursive: true });
  const pattern = path.join(outDir, "part_%03d.mp4");
  const args = [
    "-hide_banner",
    "-y",
    "-i",
    inputPath,
    "-c",
    "copy",
    "-f",
    "segment",
    "-segment_time",
    String(segmentLenSec),
    "-reset_timestamps",
    "1",
    pattern,
  ];
  const ok = await new Promise<boolean>((resolve) => {
    const ps = spawn("ffmpeg", args);
    ps.on("error", () => resolve(false));
    ps.on("exit", (code) => resolve(code === 0));
  });
  if (!ok) return [{ path: inputPath, offsetSec: 0 }];
  const files = (await fs.readdir(outDir)).filter((f) => f.startsWith("part_")).sort();
  if (!files.length) return [{ path: inputPath, offsetSec: 0 }];

  const segments: VideoSegment[] = [];
  let offsetSec = 0;
  for (const file of files) {
    const segmentPath = path.join(outDir, file);
    segments.push({ path: segmentPath, offsetSec });
    const durationSec = await probeVideoDurationSec(segmentPath);
    offsetSec += durationSec > 0 ? durationSec : segmentLenSec;
  }
  return segments;
}

async function probeVideoDurationSec(inputPath: string): Promise<number> {
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ];
  return await new Promise<number>((resolve) => {
    const ps = spawn("ffprobe", args);
    let stdout = "";
    ps.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    ps.on("error", () => resolve(0));
    ps.on("exit", (code) => {
      if (code !== 0) {
        resolve(0);
        return;
      }
      const duration = Number.parseFloat(stdout.trim());
      resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
    });
  });
}
