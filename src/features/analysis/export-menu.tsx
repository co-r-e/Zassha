"use client";

import * as React from "react";
import { useUpload } from "@/components/upload-context";
import { useI18n } from "@/components/i18n-context";
import { buildDocxSingle, buildXlsxSingle, buildPptxSingle, buildYamlSingle, makeDocLabels, type ImageMap } from "@/lib/exporters";
import { parseMarkdownContent } from "@/lib/parse-content";

type ExportType = "word" | "excel" | "pptx" | "yaml";

function triggerDownload(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function sanitize(name: string): string {
  return name.replace(/[^\p{L}\p{N}_\- ]/gu, "_").replace(/\s+/g, "_");
}

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

export default function ExportMenu({ fileId }: { fileId: string }) {
  const { t, lang } = useI18n();
  const { files, resultsById, previewUrlsById, videoMetaById } = useUpload();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | ExportType>("");
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const file = files.find((f) => f.id === fileId) || null;
  const isReady = !!(file && resultsById[fileId]);

  async function handle(type: ExportType) {
    try {
      setBusy(type);
      if (!file || !isReady) return;
      const today = formatDateYYYYMMDD(new Date());
      const base = stripExt(file.file.name);
      const safeBase = sanitize(base);
      const content = parseMarkdownContent(resultsById[fileId]!);

      if (type === "excel") {
        const sheetName = `zassha_${safeBase}_${today}`;
        const blob = await buildXlsxSingle({ fileName: file.file.name, content }, sheetName);
        triggerDownload(`zassha_${safeBase}_${today}.xlsx`, blob);
        return;
      }
      if (type === "yaml") {
        const blob = await buildYamlSingle({ fileName: file.file.name, content });
        triggerDownload(`zassha_${safeBase}_${today}.yaml`, blob);
        return;
      }

      const videoUrl = previewUrlsById[fileId];
      const dur = videoMetaById[fileId]?.duration || 0;
      const images = videoUrl ? await captureImagesForContent(videoUrl, dur, content) : undefined;
      const labels = makeDocLabels(lang);

      if (type === "word") {
        const blob = await buildDocxSingle({ fileName: file.file.name, content }, images, labels);
        triggerDownload(`zassha_${safeBase}_${today}.docx`, blob);
      } else {
        const blob = await buildPptxSingle({ fileName: file.file.name, content }, images, labels);
        triggerDownload(`zassha_${safeBase}_${today}.pptx`, blob);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`${t("errorOccurred")} ${msg}`);
    } finally {
      setBusy("");
      setOpen(false);
    }
  }

  async function captureImagesForContent(videoUrl: string, videoDuration: number, content: ReturnType<typeof parseMarkdownContent>): Promise<ImageMap> {
    const images: ImageMap = {};
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = videoUrl;
    await once(v, "loadedmetadata");
    const natW = v.videoWidth || 1280;
    const natH = v.videoHeight || 720;
    const targetW = Math.min(1920, natW);
    const scale = targetW / natW;
    const targetH = Math.round(natH * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return images;

    const seekTo = (time: number) => new Promise<void>((resolve, reject) => {
      const maxDur = videoDuration || v.duration || 0;
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
      const onErr = () => { cleanup(); reject(new Error("media error")); };
      const timer = window.setTimeout(() => { cleanup(); resolve(); }, 2000);
      v.addEventListener("seeked", onSeek, { once: true });
      v.addEventListener("error", onErr, { once: true });
      v.currentTime = target;
    });

    const steps = content.businessDetails || [];
    for (let s = 0; s < steps.length; s++) {
      const step = steps[s];
      const ops = step.operations.length ? step.operations : [{ text: "" }];
      const spanStart = typeof step.timeStartSec === "number" ? step.timeStartSec : null;
      const spanEnd = typeof step.timeEndSec === "number" ? step.timeEndSec : null;
      for (let o = 0; o < ops.length; o++) {
        const op = ops[o];
        let t = typeof op.opTimeSec === "number" ? op.opTimeSec : null;
        if (t == null && spanStart != null && spanEnd != null && spanEnd > spanStart) {
          const frac = (o + 1) / (ops.length + 1);
          t = spanStart + frac * (spanEnd - spanStart);
        }
        if (t == null && spanStart != null) t = spanStart + o * 4;
        if (t == null && videoDuration > 0) t = Math.max(0.1, Math.min(videoDuration - 0.1, (videoDuration * (o + 1)) / (ops.length + 1)));
        if (t == null) t = 0;
        await seekTo(t);
        ctx.drawImage(v, 0, 0, targetW, targetH);
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.95));
        const buf = await blob.arrayBuffer();
        images[`${s}-${o}`] = { data: buf, width: targetW, height: targetH, caption: undefined };
      }
    }
    v.src = "";
    return images;
  }

  function once(el: HTMLMediaElement, ev: "loadedmetadata" | "seeked") {
    return new Promise<void>((resolve, reject) => {
      const on = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); reject(new Error("media error")); };
      const cleanup = () => {
        el.removeEventListener(ev, on);
        el.removeEventListener("error", onErr);
      };
      el.addEventListener(ev, on, { once: true });
      el.addEventListener("error", onErr, { once: true });
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={!isReady || !!busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted transition-colors"
        title={!isReady ? (t("willShowAfterAnalysis") as string) : undefined}
      >
        <span className="font-medium">{t("export")}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" className="opacity-70"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-md border border-border bg-card shadow-sm overflow-hidden z-10">
          {([
            { type: "word", label: "downloadWord" },
            { type: "pptx", label: "downloadPptx" },
            { type: "excel", label: "downloadExcel" },
            { type: "yaml", label: "downloadYaml" },
          ] as const).map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-muted disabled:opacity-60"
              onClick={() => void handle(type)}
              disabled={!!busy}
            >
              {busy === type ? "…" : t(label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
