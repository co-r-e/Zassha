"use client";

import * as React from "react";
// import NextImage from "next/image";
import Lightbox from "@/components/ui/lightbox";
import { Clock, Eye, List } from "lucide-react";
import { useI18n } from "@/components/i18n-context";
import { parseMarkdownContent, parseTwoColTable } from "@/lib/parse-content";
import SegmentPlayer from "@/components/SegmentPlayer";
import VideoLightbox from "@/components/ui/video-lightbox";

// type imports are handled in parse-content users as needed

// parsing functions are imported from '@/lib/parse-content'

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
  const { t, lang } = useI18n();
  const content = React.useMemo(() => parseMarkdownContent(source), [source]);
  const [thumbs, setThumbs] = React.useState<Record<string, string | null>>({});
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<{ src: string; alt: string } | null>(null);
  const [videoBox, setVideoBox] = React.useState<{ src: string; start: number; end: number; poster?: string; label?: string } | null>(null);

  const formatDurationLabel = (seconds: number): string => {
    const sec = Math.max(0, Math.round(seconds));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return lang === "ja" ? `【所要時間${m}分${s}秒】` : `【Duration ${m}m ${s}s】`;
  };

  const stepDurationSec = (step: { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number }> }): number | null => {
    if (typeof step.timeStartSec === "number" && typeof step.timeEndSec === "number" && step.timeEndSec > step.timeStartSec) {
      return step.timeEndSec - step.timeStartSec;
    }
    let minStart: number | null = null;
    let maxEnd: number | null = null;
    for (const op of step.operations) {
      if (typeof op.opStartSec === "number") minStart = minStart == null ? op.opStartSec : Math.min(minStart, op.opStartSec);
      if (typeof op.opEndSec === "number") maxEnd = maxEnd == null ? op.opEndSec : Math.max(maxEnd, op.opEndSec);
    }
    if (minStart != null && maxEnd != null && maxEnd > minStart) return maxEnd - minStart;
    return null;
  };

  const opDurationSec = (
    op: { opStartSec?: number; opEndSec?: number; opTimeSec?: number },
    oIdx: number,
    step: { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number; opTimeSec?: number }> }
  ): number => {
    // 1) Explicit range
    if (typeof op.opStartSec === "number" && typeof op.opEndSec === "number" && op.opEndSec > op.opStartSec) {
      return Math.max(1, op.opEndSec - op.opStartSec);
    }
    const nOps = Math.max(1, step.operations.length);
    const stepHasRange = typeof step.timeStartSec === "number" && typeof step.timeEndSec === "number" && step.timeEndSec! > step.timeStartSec!;
    // 2) From current → next operation time
    if (typeof op.opTimeSec === "number") {
      // find next op with time
      for (let i = oIdx + 1; i < nOps; i++) {
        const nxt = step.operations[i];
        if (typeof nxt.opTimeSec === "number" && nxt.opTimeSec! > op.opTimeSec!) {
          return Math.max(1, nxt.opTimeSec! - op.opTimeSec!);
        }
      }
      // last op with time and step has end → until step end
      if (stepHasRange) {
        return Math.max(1, (step.timeEndSec! - op.opTimeSec!));
      }
    }
    // 3) Even split within step range
    if (stepHasRange) {
      const len = step.timeEndSec! - step.timeStartSec!;
      return Math.max(1, len / nOps);
    }
    // 4) Fallback default (preview uses ±2s → 約4秒)
    return 4;
  };

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
        // High-quality capture: increase cap and devicePixelRatio for sharper thumbs
        const maxW = 1920; // capture cap for width (up from 1280)
        const natW = v.videoWidth || 1280;
        const natH = v.videoHeight || 720;
        const scaleTo = Math.min(1, maxW / natW);
        const W = Math.max(320, Math.round(natW * scaleTo));
        const H = Math.max(180, Math.round(natH * scaleTo));
        const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
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
          const url = canvas.toDataURL("image/webp", 0.97);
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
                  <span className="text-[11px] font-semibold text-muted-foreground">{t("duration")}</span>
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
              {(() => { const seenSegments = new Set<string>(); return (
              <table className="w-full min-w-[1600px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-12">No.</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-48">{t("stepName")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-72">{t("stepInference")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-36">{t("usedTool")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-80">{t("operations")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-60">{t("operationVideo")}</th>
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
                            {(() => { const d = stepDurationSec(step); return d != null ? (
                              <div className="text-[10px] text-muted-foreground mt-0.5">{formatDurationLabel(d)}</div>
                            ) : null; })()}
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
                            <div>{op.text}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{formatDurationLabel(opDurationSec(op as { opStartSec?: number; opEndSec?: number; opTimeSec?: number }, oIdx, step as { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number; opTimeSec?: number }> }))}</div>
                          </div>
                        </td>

                        {/* Screenshot/Segment column to the right of operation */}
                        <td className="p-3 align-top">
                          {videoUrl ? (
                            (() => {
                              // compute segment [start,end]
                              let start: number | null = null;
                              let end: number | null = null;
                              if (typeof op.opStartSec === "number" && typeof op.opEndSec === "number" && op.opEndSec > op.opStartSec) {
                                start = op.opStartSec; end = op.opEndSec;
                              } else if (typeof step.timeStartSec === "number" && typeof step.timeEndSec === "number" && step.timeEndSec > step.timeStartSec) {
                                const center = step.timeStartSec + ((oIdx + 1) / (opCount + 1)) * (step.timeEndSec - step.timeStartSec);
                                start = Math.max(step.timeStartSec, center - 2);
                                end = Math.min(step.timeEndSec, center + 2);
                              } else if (typeof (op as { opTimeSec?: number }).opTimeSec === "number") {
                                const c = (op as { opTimeSec?: number }).opTimeSec as number;
                                start = Math.max(0, c - 2);
                                end = c + 2;
                              } else if (typeof videoDurationSec === "number" && videoDurationSec > 0) {
                                const c = ((oIdx + 1) / (opCount + 1)) * videoDurationSec;
                                start = Math.max(0, c - 2);
                                end = Math.min(videoDurationSec, c + 2);
                              }
                              if (start == null || end == null || end <= start) {
                                return (
                                  <div className="relative w-[200px] h-[112px] rounded-md border border-border bg-card overflow-hidden grid place-items-center text-[10px] text-muted-foreground">
                                    {thumbs[`${sIdx}-${oIdx}`] ? t("view") : (isCapturing ? t("capturing") : t("captureFailed"))}
                                  </div>
                                );
                              }
                              const segKey = `${videoUrl}|${start.toFixed(2)}-${end.toFixed(2)}`;
                              if (seenSegments.has(segKey)) {
                                return (
                                  <div className="w-[200px] h-[112px] grid place-items-center text-xs text-muted-foreground">-</div>
                                );
                              }
                              seenSegments.add(segKey);
                              return (
                                <div onClick={() => setVideoBox({ src: videoUrl!, start, end, poster: thumbs[`${sIdx}-${oIdx}`] || undefined, label: op.opTimestamp || step.stepTimestamp })} className="cursor-zoom-in">
                                  <SegmentPlayer
                                    src={videoUrl}
                                    start={start}
                                    end={end}
                                    poster={thumbs[`${sIdx}-${oIdx}`] || undefined}
                                    width={200}
                                    height={112}
                                    label={op.opTimestamp || step.stepTimestamp}
                                  />
                                </div>
                              );
                          })()
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
              ); })()}
            </div>
            {/* note: per-operation rows can be many; consider virtualizing in future */}
          </div>
        </div>
      )}
      <Lightbox open={!!lightbox} src={lightbox?.src ?? null} alt={lightbox?.alt ?? ""} onClose={() => setLightbox(null)} />
      <VideoLightbox
        open={!!videoBox}
        src={videoBox?.src ?? null}
        start={videoBox?.start ?? 0}
        end={videoBox?.end ?? 0}
        poster={videoBox?.poster ?? null}
        label={videoBox?.label ?? null}
        onClose={() => setVideoBox(null)}
      />
    </div>
  );
}
