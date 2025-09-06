"use client";

import * as React from "react";
import { useUpload } from "@/components/upload-context";
import { Button } from "@/components/ui/button";
import { FileVideo, Timer, Maximize2, HardDrive, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/components/i18n-context";

function formatDuration(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"] as const;
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) { size /= 1024; unitIndex++; }
  const decimals = size >= 10 ? 0 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

export default function SidebarUploader() {
  const { t } = useI18n();
  const {
    files, setFiles, isLoading, progressById, error,
    analysisMode, setAnalysisMode, hint, setHint, previewUrlsById, videoMetaById, setVideoMeta,
    handleDrop, handleDragOver, handleFileInput, handleAnalyze,
  } = useUpload();

  const selected = files.filter((f) => f.selected);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-3">
        <div onDrop={handleDrop} onDragOver={handleDragOver}>
          <label className="block cursor-pointer rounded-lg border border-dashed border-border p-3 text-center hover:bg-muted transition-colors text-[12px]">
            <input
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => { handleFileInput(e.target.files); e.currentTarget.value = ""; }}
              className="sr-only"
            />
            {t("dropOrClick")}
          </label>
        </div>

        {files.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-auto pr-1">
            {files.map((sf) => (
              <div key={sf.id} className="rounded-md border p-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={sf.selected}
                      onChange={(e) => setFiles((prev) => prev.map((x) => (x.id === sf.id ? { ...x, selected: e.target.checked } : x)))}
                      aria-label={t("select")}
                      title={t("select")}
                    />
                    <span className="truncate max-w-[150px] text-[11px]">{sf.file.name}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={t("delete")}
                    className="ml-2 inline-flex items-center text-muted-foreground hover:text-primary"
                    onClick={() => setFiles((prev) => prev.filter((x) => x.id !== sf.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {typeof progressById[sf.id] === "number" && (
                  <div className="mt-1">
                    <Progress value={progressById[sf.id]} />
                    <div className="mt-0.5 text-[10px] text-muted-foreground text-right">
                      {Math.round(progressById[sf.id])}%
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setAnalysisMode("summary")}
              className={`px-2 py-1 text-[11px] rounded-full transition-colors ${analysisMode === "summary" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
              aria-pressed={analysisMode === "summary"}
            >{t("summary")}</button>
            <button
              type="button"
              onClick={() => setAnalysisMode("detail")}
              className={`px-2 py-1 text-[11px] rounded-full transition-colors ${analysisMode === "detail" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
              aria-pressed={analysisMode === "detail"}
            >{t("detail")}</button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] mb-1 text-muted-foreground">{t("hintLabel")}</label>
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder={t("hintPlaceholder")}
            className="w-full rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground px-2 py-1 text-[12px]"
            maxLength={160}
          />
        </div>

        {/* per-file progress shown above in the file list */}
        {error && (
          <div className="text-[11px] text-destructive text-center">
            {(() => {
              const e = String(error);
              const keyMissing = e.includes("GEMINI_API_KEY is not set") || (/GEMINI/.test(e) && /API_KEY|key/i.test(e));
              return keyMissing ? t("apiKeyMissing") : `${t("errorPrefix")}: ${e}`;
            })()}
          </div>
        )}

        <Button
          type="button"
          disabled={isLoading || selected.length === 0}
          aria-label={t("analyze")}
          className="w-full h-8 text-[12px] px-3 py-1.5 mt-1"
          title={selected.length === 0 ? t("analyzeHint") : undefined}
          onClick={() => void handleAnalyze()}
        >{t("analyze")}</Button>

        {/* 一括リセットボタンは不要のため削除 */}

        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <FileVideo className="h-3.5 w-3.5 text-foreground" />
            <h2 className="font-semibold text-[12px] truncate">{t("preview")}</h2>
          </div>
          {selected.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-auto pr-1">
              {selected.map((sf) => (
                <div key={sf.id} className="space-y-1">
                  <div className="rounded-md overflow-hidden bg-card border border-border">
                    <video
                      className="w-full h-auto block"
                      src={previewUrlsById[sf.id]}
                      controls
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget as HTMLVideoElement;
                        setVideoMeta(sf.id, { duration: v.duration, width: v.videoWidth, height: v.videoHeight });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1"><Timer className="h-3 w-3" /><span>{videoMetaById[sf.id] ? formatDuration(videoMetaById[sf.id].duration) : "--:--"}</span></div>
                    <div className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /><span>{videoMetaById[sf.id] ? `${videoMetaById[sf.id].width}×${videoMetaById[sf.id].height}` : "--×--"}</span></div>
                    <div className="flex items-center gap-1"><HardDrive className="h-3 w-3" /><span>{formatBytes(sf.file.size)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground border border-dashed border-border rounded-md p-4 bg-card text-center">
              {t("showAfterUpload")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
