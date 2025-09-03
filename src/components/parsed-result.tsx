"use client";

import * as React from "react";
import NextImage from "next/image";
import Lightbox from "@/components/ui/lightbox";
import { Clock, Eye, List } from "lucide-react";
import { useI18n } from "@/components/i18n-context";

type ParsedContent = {
  overview?: string;
  duration?: string;
  businessInference?: string;
  businessDetails?: Array<{
    stepName: string;
    operations: Array<{ text: string; opTimestamp?: string; opTimeSec?: number }>;
    stepTool?: string;
    stepInference?: string;
    stepTimestamp?: string;
    timeStartSec?: number;
    timeEndSec?: number;
  }>;
};

function parseTwoColTable(md: string): Array<{ task: string; detail: string }> {
  const lines = md.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => {
    if (!l.includes("|")) return false;
    const low = l.toLowerCase();
    return (
      (low.includes("business task") && low.includes("business details")) ||
      (l.includes("業務工程") && l.includes("業務詳細"))
    );
  });
  if (headerIdx < 0) return [];
  const rows: Array<{ task: string; detail: string }> = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const L = lines[i];
    if (!L.includes("|")) {
      // stop when table ends (first non-table line after header separator)
      if (rows.length > 0) break;
      continue;
    }
    const cells = L.split("|").map((s) => s.trim());
    if (cells.length < 4) continue;
    const task = cells[1] || "";
    const detail = cells[2] || "";
    if (task || detail) rows.push({ task, detail });
  }
  return rows;
}

function parseTimestampToSeconds(ts: string): number | null {
  // supports mm:ss or hh:mm:ss
  const parts = ts.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || /[^0-9]/.test(p))) return null;
  let h = 0, m = 0, s = 0;
  if (parts.length === 2) {
    [m, s] = parts.map((x) => Number(x));
  } else if (parts.length === 3) {
    [h, m, s] = parts.map((x) => Number(x));
  } else {
    return null;
  }
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  return h * 3600 + m * 60 + s;
}

function parseTimestampField(raw: string): { start?: number; end?: number; label: string } | null {
  // Accept formats like "00:45", "00:45–01:20" or "00:45-01:20"
  const cleaned = raw.replace(/\s+/g, "");
  const m = cleaned.split(/[–-]/);
  if (m.length === 1) {
    const t = parseTimestampToSeconds(m[0]);
    if (t == null) return null;
    return { start: t, label: raw.trim() };
  }
  if (m.length === 2) {
    const a = parseTimestampToSeconds(m[0]);
    const b = parseTimestampToSeconds(m[1]);
    if (a == null || b == null) return null;
    const [start, end] = a <= b ? [a, b] : [b, a];
    return { start, end, label: raw.trim() };
  }
  return null;
}

function parseMarkdownContent(md: string): ParsedContent {
  const lines = md.split(/\r?\n/);
  const result: ParsedContent = {
    businessDetails: []
  };

  let currentSection = "";
  let currentStep: { stepName: string; operations: Array<{ text: string; opTimestamp?: string; opTimeSec?: number }>; stepInference?: string; stepTool?: string; stepTimestamp?: string; timeStartSec?: number; timeEndSec?: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## 概要") || trimmed.toLowerCase().startsWith("## overview")) {
      currentSection = "overview";
      continue;
    } else if (trimmed.startsWith("## 所要時間") || trimmed.toLowerCase().startsWith("## duration")) {
      currentSection = "duration";
      continue;
    } else if (trimmed.startsWith("## 業務推察") || trimmed.toLowerCase().startsWith("## business inference")) {
      currentSection = "businessInference";
      continue;
    } else if (trimmed.startsWith("## 業務詳細") || trimmed.toLowerCase().startsWith("## business details")) {
      currentSection = "businessDetails";
      continue;
    } else if (trimmed.startsWith("### ")) {
      // Save previous step if exists
      if (currentStep) {
        result.businessDetails!.push(currentStep);
      }
      // Start new step
      const stepName = trimmed
        .replace(/^### /, "")
        .replace(/^ステップ\d+:\s*/, "")
        .replace(/^step\s*\d+:\s*/i, "");
      currentStep = { stepName, operations: [] };
      continue;
    }

    if (!trimmed) continue;

    switch (currentSection) {
      case "overview":
        if (!result.overview && !trimmed.startsWith("#")) {
          result.overview = trimmed.replace(/^\[|\]$/g, "");
        }
        break;
      case "duration":
        if (!result.duration && !trimmed.startsWith("#")) {
          result.duration = trimmed.replace(/^\[|\]$/g, "");
        }
        break;
      case "businessInference":
        if (!result.businessInference && !trimmed.startsWith("#")) {
          result.businessInference = trimmed.replace(/^\[|\]$/g, "");
        }
        break;
      case "businessDetails":
        if (((/^\*\*タイムスタンプ:\*\*/.test(trimmed) || /^\*\*timestamp:\*\*/i.test(trimmed)) && currentStep)) {
          const raw = trimmed.replace(/^\*\*タイムスタンプ:\*\*\s*/, "").replace(/^\*\*timestamp:\*\*\s*/i, "");
          const parsed = parseTimestampField(raw);
          currentStep.stepTimestamp = raw;
          if (parsed) {
            currentStep.timeStartSec = parsed.start;
            currentStep.timeEndSec = parsed.end;
          }
        } else if ((/^\*\*使用ツール:\*\*/.test(trimmed) || /^\*\*used tool:\*\*/i.test(trimmed)) && currentStep) {
          currentStep.stepTool = trimmed.replace(/^\*\*使用ツール:\*\*\s*/, "");
          currentStep.stepTool = currentStep.stepTool.replace(/^\*\*used tool:\*\*\s*/i, "");
        } else if (trimmed.startsWith("- ") && currentStep) {
          const raw = trimmed.substring(2);
          // Parse leading [mm:ss] or [mm:ss–mm:ss]
          const m = raw.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)(?:[–-](\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(.*)$/);
          if (m) {
            const start = parseTimestampToSeconds(m[1]);
            const end = m[2] ? parseTimestampToSeconds(m[2]) : null;
            const time = start != null && end != null ? (start + end) / 2 : start != null ? start : null;
            currentStep.operations.push({ text: m[3] || "", opTimestamp: m[0].slice(0, m[0].indexOf("]") + 1), opTimeSec: time ?? undefined });
          } else {
            currentStep.operations.push({ text: raw });
          }
        } else if ((/^\*\*業務推察:\*\*/.test(trimmed) || /^\*\*business inference:\*\*/i.test(trimmed)) && currentStep) {
          currentStep.stepInference = trimmed.replace(/^\*\*業務推察:\*\*\s*/, "");
          currentStep.stepInference = currentStep.stepInference.replace(/^\*\*business inference:\*\*\s*/i, "");
        }
        break;
    }
  }

  // Save last step if exists
  if (currentStep) {
    result.businessDetails!.push(currentStep);
  }

  return result;
}

export default function ParsedResult({
  source,
  tokens,
  videoUrl,
  videoDurationSec,
}: {
  source: string;
  tokens?: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  videoUrl?: string | null;
  videoDurationSec?: number | null;
}) {
  const { t } = useI18n();
  const content = React.useMemo(() => parseMarkdownContent(source), [source]);
  const [thumbs, setThumbs] = React.useState<Record<string, string | null>>({});
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<{ src: string; alt: string } | null>(null);

  // no mount flag needed

  // Generate step thumbnails from the provided video URL (client-side)
  React.useEffect(() => {
    if (!videoUrl || !(content.businessDetails && content.businessDetails.length)) {
      setThumbs({});
      return;
    }
    let cancelled = false;
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = videoUrl;
    setIsCapturing(true);
    const run = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => resolve();
          const onError = () => reject(new Error("video load error"));
          v.addEventListener("loadedmetadata", onLoaded, { once: true });
          v.addEventListener("error", onError, { once: true });
        });
        // High-quality capture: scale up to natural size with a sensible cap and devicePixelRatio
        const maxW = 1280; // capture cap for width
        const natW = v.videoWidth || 1280;
        const natH = v.videoHeight || 720;
        const scaleTo = Math.min(1, maxW / natW);
        const W = Math.max(320, Math.round(natW * scaleTo));
        const H = Math.max(180, Math.round(natH * scaleTo));
        const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        if (dpr !== 1) {
          ctx.scale(dpr, dpr);
        }

        const dur = v.duration || videoDurationSec || 0;
        const steps = content.businessDetails as NonNullable<typeof content.businessDetails>;
        const targets: Array<{ key: string; time: number }> = [];
        let globalIndex = 0;
        for (let s = 0; s < steps.length; s++) {
          const step = steps[s];
          const nOps = step.operations.length || 1;
          for (let o = 0; o < nOps; o++) {
            const op = step.operations[o];
            let t: number | null = null;
            if (typeof op.opTimeSec === "number") {
              t = op.opTimeSec;
            } else if (typeof step.timeStartSec === "number" && typeof step.timeEndSec === "number" && step.timeEndSec > step.timeStartSec) {
              const frac = (o + 1) / (nOps + 1);
              t = step.timeStartSec + frac * (step.timeEndSec - step.timeStartSec);
            } else if (typeof step.timeStartSec === "number") {
              t = step.timeStartSec + o * 4; // 4s stride fallback
            } else if (dur > 0) {
              t = Math.max(0.1, Math.min(dur - 0.1, (dur * (globalIndex + 1)) / (steps.length * (nOps + 1))));
            } else {
              t = 0;
            }
            targets.push({ key: `${s}-${o}`, time: Math.max(0, t) });
            globalIndex++;
          }
        }

        for (const tgt of targets) {
          if (cancelled) break;
          await new Promise<void>((resolve, reject) => {
            const onSeek = () => resolve();
            const onErr = () => reject(new Error("seek error"));
            v.removeEventListener("seeked", onSeek);
            v.currentTime = Math.max(0, Math.min(dur || v.duration || 0, tgt.time));
            v.addEventListener("seeked", onSeek, { once: true });
            v.addEventListener("error", onErr, { once: true });
          });
          ctx.drawImage(v, 0, 0, W, H);
          const url = canvas.toDataURL("image/webp", 0.92);
          if (!cancelled) setThumbs((prev) => ({ ...prev, [tgt.key]: url }));
        }
      } catch {
        // mark all as failed once
        if (!cancelled) {
          const N = content.businessDetails?.length || 0;
          const failMap: Record<number, string | null> = {};
          for (let i = 0; i < N; i++) failMap[i] = null;
          setThumbs(failMap);
        }
      } finally {
        setIsCapturing(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      v.src = ""; // release
    };
  }, [videoUrl, videoDurationSec, content]);

  // no row toggle; always show per-operation rows

  // If section parsing failed, try 2-col Markdown table (Business Task | Business Details)
  const tableRows = React.useMemo(() => parseTwoColTable(source), [source]);
  if (!content.overview && !content.businessDetails?.length && tableRows.length > 0) {
    return (
      <div className="w-full">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <List className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t("businessDetails")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-12">No.</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-56">{t("stepName")}</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30">{t("businessDetails")}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="p-3 align-top">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">{i + 1}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="text-xs font-medium text-foreground leading-relaxed">{r.task || t("unknown")}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{r.detail || ""}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // If parsing still failed, show raw content
  if (!content.overview && !content.businessDetails?.length) {
    return (
      <div className="text-xs text-muted-foreground">
        {t("unrecognizedFormat")}
        <pre className="mt-2 whitespace-pre-wrap text-[12px] border border-border rounded-md p-3 bg-card">{source}</pre>
      </div>
    );
  }

  return (
    <div className="w-full min-w-[1100px]">
      {/* Header Section - Horizontal Layout */}
      <div className="rounded-md border border-border bg-card mb-4">
        <div className="p-4">
          <div className="grid grid-cols-[400px_400px_200px] gap-6 items-start">
            {/* Overview with Duration */}
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">{t("overview")}</div>
              <div className="text-xs text-foreground leading-relaxed mb-2">
                {content.overview || t("noOverview")}
              </div>
              {content.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">{content.duration}</span>
                </div>
              )}
            </div>

            {/* Business Inference */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Eye className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground">{t("businessInference")}</span>
              </div>
              <div className="text-xs text-foreground leading-relaxed">
                {content.businessInference || t("noInference")}
              </div>
            </div>

            {/* Token Usage */}
            {tokens && (
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground mb-2">{t("tokenUsage")}</div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("input")}:</span>
                    <span className="text-foreground font-medium">{tokens.inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("output")}:</span>
                    <span className="text-foreground font-medium">{tokens.outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span className="text-muted-foreground">{t("total")}:</span>
                    <span className="text-foreground font-medium">{tokens.totalTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>

      {/* Business Details Section - Table Layout */}
      {content.businessDetails && content.businessDetails.length > 0 && (
        <div className="rounded-md border border-border bg-card">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <List className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{t("businessDetails")}</span>
            </div>

            {/* Table Layout */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-12">No.</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-56">{t("stepName")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-96">{t("stepInference")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-44">{t("usedTool")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-96">{t("operations")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-60">{t("screenshot")}</th>
                  </tr>
                </thead>
                <tbody>
                  {content.businessDetails.map((step, sIdx) => {
                    const opCount = step.operations.length || 1;
                    return step.operations.map((op, oIdx) => (
                      <tr key={`${sIdx}-${oIdx}`} className="border-b border-border">
                        {oIdx === 0 && (
                          <td className="p-3 align-top" rowSpan={opCount}>
                            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                              {sIdx + 1}
                            </div>
                          </td>
                        )}
                        {oIdx === 0 && (
                          <td className="p-3 align-top" rowSpan={opCount}>
                            <div className="text-xs font-medium text-foreground leading-relaxed">
                              {step.stepName}
                            </div>
                            {step.stepTimestamp && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">{step.stepTimestamp}</div>
                            )}
                          </td>
                        )}
                        {oIdx === 0 && (
                          <td className="p-3 align-top" rowSpan={opCount}>
                            <div className="text-xs text-foreground leading-relaxed">
                              {step.stepInference || t("noInference")}
                            </div>
                          </td>
                        )}
                        {oIdx === 0 && (
                          <td className="p-3 align-top" rowSpan={opCount}>
                            <div className="text-xs text-foreground leading-relaxed">
                              {step.stepTool || t("unknown")}
                            </div>
                          </td>
                        )}

                        {/* Operation text */}
                        <td className="p-3 align-top">
                          <div className="text-xs text-foreground leading-relaxed break-words">
                            {op.opTimestamp && (
                              <span className="inline-flex items-center text-[10px] px-1 py-[1px] rounded border border-border bg-muted/60 mr-1 align-middle">{op.opTimestamp}</span>
                            )}
                            <span>{op.text}</span>
                          </div>
                        </td>

                        {/* Screenshot column to the right of operation */}
                        <td className="p-3 align-top">
                          {videoUrl ? (
                            <div className="relative w-[200px] h-[112px] rounded-md border border-border bg-card overflow-hidden">
                              {thumbs[`${sIdx}-${oIdx}`] ? (
                                (() => {
                                  const src = thumbs[`${sIdx}-${oIdx}`] as string;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setLightbox({ src, alt: `${step.stepName} - ${op.text}` })}
                                      className="block w-full h-full"
                                      title={t("view")}
                                    >
                                      <NextImage src={src} alt={`${step.stepName} - ${op.text}`} width={200} height={112} className="w-full h-full object-cover" />
                                    </button>
                                  );
                                })()
                              ) : (
                                <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">
                                  {isCapturing ? t("capturing") : t("captureFailed")}
                                </div>
                              )}
                              {(op.opTimestamp || step.stepTimestamp) && (
                                <div className="absolute left-1 top-1 text-[10px] bg-background/80 text-foreground rounded px-1 py-[1px] border border-border">
                                  {op.opTimestamp || step.stepTimestamp}
                                </div>
                              )}
                            </div>
                          ) : (
                          <div className="text-[10px] text-muted-foreground">{t("noVideo")}</div>
                          )}
                        </td>

                        {/* step inference moved next to step name */}
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
            {/* note: per-operation rows can be many; consider virtualizing in future */}
          </div>
        </div>
      )}
      <Lightbox open={!!lightbox} src={lightbox?.src ?? null} alt={lightbox?.alt ?? ""} onClose={() => setLightbox(null)} />
    </div>
  );
}
