"use client";

import * as React from "react";
import Lightbox from "@/components/ui/lightbox";
import { Clock, Eye, List } from "lucide-react";
import { useI18n } from "@/components/i18n-context";
import { parseMarkdownContent, parseTwoColTable } from "@/lib/parse-content";
import SegmentPlayer from "@/features/analysis/segment-player";
import VideoLightbox from "@/components/ui/video-lightbox";
function opDurationSecHelper(
  op: { opStartSec?: number; opEndSec?: number; opTimeSec?: number },
  oIdx: number,
  step: { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number; opTimeSec?: number }> }
): number {
  if (typeof op.opStartSec === "number" && typeof op.opEndSec === "number" && op.opEndSec > op.opStartSec) {
    return Math.max(1, op.opEndSec - op.opStartSec);
  }
  const nOps = Math.max(1, step.operations.length);
  const stepHasRange = typeof step.timeStartSec === "number" && typeof step.timeEndSec === "number" && step.timeEndSec! > step.timeStartSec!;
  if (typeof op.opTimeSec === "number") {
    for (let i = oIdx + 1; i < nOps; i++) {
      const nxt = step.operations[i];
      if (typeof nxt.opTimeSec === "number" && nxt.opTimeSec! > op.opTimeSec!) {
        return Math.max(1, nxt.opTimeSec! - op.opTimeSec!);
      }
    }
    if (stepHasRange) return Math.max(1, (step.timeEndSec! - op.opTimeSec!));
  }
  if (stepHasRange) {
    const len = step.timeEndSec! - step.timeStartSec!;
    return Math.max(1, len / nOps);
  }
  return 4;
}

function clampRangeToDuration(
  range: { start: number; end: number },
  videoDur?: number | null
): { start: number; end: number } {
  if (typeof videoDur !== "number" || videoDur <= 0) return range;
  const start = Math.max(0, Math.min(range.start, videoDur));
  const end = Math.max(start, Math.min(range.end, videoDur));
  return { start, end };
}

function opStartEndHelper(
  op: { opStartSec?: number; opEndSec?: number; opTimeSec?: number },
  oIdx: number,
  step: { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number; opTimeSec?: number }> },
  totalOps: number,
  videoDur?: number | null
): { start: number | null; end: number | null } {
  if (typeof op.opStartSec === "number" && typeof op.opEndSec === "number" && op.opEndSec > op.opStartSec) {
    return clampRangeToDuration({ start: op.opStartSec, end: op.opEndSec }, videoDur);
  }
  const dur = Math.max(1, opDurationSecHelper(op, oIdx, step));
  if (typeof op.opTimeSec === "number") {
    const rawStart = Math.max(0, op.opTimeSec);
    const start = (typeof videoDur === "number" && videoDur > 0)
      ? Math.min(rawStart, Math.max(0, videoDur - 0.001))
      : rawStart;
    const end = start + dur;
    const clamped = clampRangeToDuration({ start, end }, videoDur);
    const fallbackEnd = (typeof videoDur === "number" && videoDur > 0)
      ? Math.min(videoDur, clamped.start + 1)
      : clamped.start + 1;
    return clamped.end > clamped.start ? clamped : { start: clamped.start, end: fallbackEnd };
  }
  if (typeof step.timeStartSec === "number" && typeof step.timeEndSec === "number" && step.timeEndSec > step.timeStartSec) {
    const len = step.timeEndSec - step.timeStartSec;
    const start = step.timeStartSec + (oIdx / Math.max(1, totalOps)) * len;
    const end = Math.min(step.timeEndSec, start + dur);
    const clamped = clampRangeToDuration({ start, end }, videoDur);
    const fallbackEnd = (typeof videoDur === "number" && videoDur > 0)
      ? Math.min(videoDur, clamped.start + 1)
      : clamped.start + 1;
    return clamped.end > clamped.start ? clamped : { start: clamped.start, end: fallbackEnd };
  }
  if (typeof videoDur === "number" && videoDur > 0) {
    const c = ((oIdx + 1) / (Math.max(1, totalOps) + 1)) * videoDur;
    const start = Math.max(0, Math.min(c, Math.max(0, videoDur - dur)));
    const end = Math.min(videoDur, start + dur);
    const clamped = clampRangeToDuration({ start, end }, videoDur);
    return clamped.end > clamped.start ? clamped : { start: clamped.start, end: Math.min(videoDur, clamped.start + 1) };
  }
  return { start: null, end: null };
}

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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

  const opDurationSec = opDurationSecHelper;
  const opStartEnd = opStartEndHelper;

  

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
            const { start } = opStartEnd(
              op as { opStartSec?: number; opEndSec?: number; opTimeSec?: number },
              o,
              step as { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number; opTimeSec?: number }> },
              nOps,
              dur
            );
            let t: number;
            if (typeof start === "number") {
              t = start;
            } else if (typeof op.opTimeSec === "number") {
              t = op.opTimeSec;
            } else if (typeof step.timeStartSec === "number" && typeof step.timeEndSec === "number" && step.timeEndSec > step.timeStartSec) {
              const frac = (o + 1) / (nOps + 1);
              t = step.timeStartSec + frac * (step.timeEndSec - step.timeStartSec);
            } else if (typeof step.timeStartSec === "number") {
              t = step.timeStartSec + o * 4;
            } else if (dur > 0) {
              t = Math.max(0.1, Math.min(dur - 0.1, (dur * (globalIndex + 1)) / (steps.length * (nOps + 1))));
            } else {
              t = 0;
            }
            targets.push({ key: `${s}-${o}`, time: Math.max(0, t) });
            globalIndex++;
          }
        }

        const seekTo = (time: number) => new Promise<void>((resolve, reject) => {
          const maxDur = dur || v.duration || 0;
          const target = Math.max(0, Math.min(maxDur, time));
          if (Math.abs(v.currentTime - target) < 0.01) {
            resolve();
            return;
          }
          let done = false;
          const cleanup = () => {
            if (done) return;
            done = true;
            v.removeEventListener("seeked", onSeek);
            v.removeEventListener("error", onErr);
            clearTimeout(timer);
          };
          const onSeek = () => { cleanup(); resolve(); };
          const onErr = () => { cleanup(); reject(new Error("seek error")); };
          const timer = window.setTimeout(() => { cleanup(); resolve(); }, 2000);
          v.addEventListener("seeked", onSeek, { once: true });
          v.addEventListener("error", onErr, { once: true });
          v.currentTime = target;
        });

        for (const tgt of targets) {
          if (cancelled) break;
          await seekTo(tgt.time);
          ctx.drawImage(v, 0, 0, W, H);
          const url = canvas.toDataURL("image/webp", 0.97);
          if (!cancelled) setThumbs((prev) => ({ ...prev, [tgt.key]: url }));
        }
      } catch {
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
      v.src = "";
    };
  }, [videoUrl, videoDurationSec, content, opStartEnd]);

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
                  <th className="text-left px-0 py-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-6">No.</th>
                  <th className="text-left pl-0 pr-2 py-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-40">{t("stepName")}</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30">{t("businessDetails")}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-0 py-3 align-top">
                      <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">{i + 1}</div>
                    </td>
                    <td className="pl-0 pr-2 py-3 align-top">
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
      
      <div className="rounded-md border border-border bg-card mb-4">
        <div className="p-4">
          <div className="grid grid-cols-[400px_400px_200px] gap-6 items-start">
            
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">{t("overview")}</div>
              <div className="text-[14px] text-foreground leading-relaxed mb-2">
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

            
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Eye className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground">{t("businessInference")}</span>
              </div>
              <div className="text-[14px] text-foreground leading-relaxed">
                {content.businessInference || t("noInference")}
              </div>
            </div>

            
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

      
      {content.businessDetails && content.businessDetails.length > 0 && (
        <div className="rounded-md border border-border bg-card">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <List className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{t("businessDetails")}</span>
            </div>

            
            <div className="overflow-x-auto">
              {(() => { const seenSegments = new Set<string>(); return (
              <table className="w-full min-w-[1600px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                  <th className="text-left px-0 py-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-6">No.</th>
                  <th className="text-left pl-0 pr-2 py-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-28">{t("stepName")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-[200px]">{t("stepInference")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-64">{t("operations")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-[300px]">{t("operationVideo")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-24">{t("usedTool")}</th>
                  </tr>
                </thead>
                <tbody>
                  {content.businessDetails.map((step, sIdx) => {
                    const opCount = step.operations.length || 1;
                    return step.operations.map((op, oIdx) => (
                      <tr key={`${sIdx}-${oIdx}`} className="border-b border-border">
                        {oIdx === 0 && (
                          <td className="px-0 py-3 align-top" rowSpan={opCount}>
                            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                              {sIdx + 1}
                            </div>
                          </td>
                        )}
                        {oIdx === 0 && (
                          <td className="pl-0 pr-2 py-3 align-top" rowSpan={opCount}>
                            <div className="text-[14px] font-medium text-foreground leading-relaxed break-words">
                              {step.stepName}
                            </div>
                            {(() => { const d = stepDurationSec(step); return d != null ? (
                              <div className="text-[10px] text-muted-foreground mt-0.5">{formatDurationLabel(d)}</div>
                            ) : null; })()}
                          </td>
                        )}
                        {oIdx === 0 && (
                          <td className="p-3 align-top w-[200px]" rowSpan={opCount}>
                            <div className="text-[14px] text-foreground leading-relaxed break-words">
                              {step.stepInference || t("noInference")}
                            </div>
                          </td>
                        )}
                        
                        <td className="p-3 align-top">
                          <div className="text-[14px] text-foreground leading-relaxed break-words">
                            <div>{op.text}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{formatDurationLabel(opDurationSec(op as { opStartSec?: number; opEndSec?: number; opTimeSec?: number }, oIdx, step as { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number; opTimeSec?: number }> }))}</div>
                          </div>
                        </td>

                        <td className="p-3 align-top">
                          {videoUrl ? (
                            (() => {
                              const { start, end } = opStartEnd(
                                op as { opStartSec?: number; opEndSec?: number; opTimeSec?: number },
                                oIdx,
                                step as { timeStartSec?: number; timeEndSec?: number; operations: Array<{ opStartSec?: number; opEndSec?: number; opTimeSec?: number }> },
                                opCount,
                                typeof videoDurationSec === "number" ? videoDurationSec : undefined
                              );
                              if (start == null || end == null || end <= start) {
                                return (
                                  <div className="relative w-[300px] h-[168px] rounded-md border border-border bg-card overflow-hidden grid place-items-center text-[10px] text-muted-foreground">
                                    {thumbs[`${sIdx}-${oIdx}`] ? t("view") : (isCapturing ? t("capturing") : t("captureFailed"))}
                                  </div>
                                );
                              }
                              const segKey = `${videoUrl}|${start.toFixed(2)}-${end.toFixed(2)}`;
                              if (seenSegments.has(segKey)) {
                                return (
                                  <div className="w-[300px] h-[168px] grid place-items-center text-xs text-muted-foreground">-</div>
                                );
                              }
                              seenSegments.add(segKey);
                              const label = `${formatTimestamp(start)}–${formatTimestamp(end)}`;
                              return (
                                <div onClick={() => setVideoBox({ src: videoUrl!, start, end, poster: thumbs[`${sIdx}-${oIdx}`] || undefined, label })} className="cursor-zoom-in">
                                  <SegmentPlayer
                                    src={videoUrl}
                                    start={start}
                                    end={end}
                                    poster={thumbs[`${sIdx}-${oIdx}`] || undefined}
                                    width={300}
                                    height={168}
                                    label={label}
                                  />
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-[10px] text-muted-foreground">{t("noVideo")}</div>
                          )}
                        </td>

                        {oIdx === 0 && (
                          <td className="p-3 align-top w-24" rowSpan={opCount}>
                            <div className="text-[14px] text-foreground leading-relaxed break-words">
                              {step.stepTool || t("unknown")}
                            </div>
                          </td>
                        )}
                        
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
              ); })()}
            </div>
            
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
