"use client";

import * as React from "react";
import { CHUNK_THRESHOLD_BYTES } from "@/config";
import { useI18n } from "@/components/i18n-context";
import type { StreamEvent } from "@/types/progress";

export type SelectedFile = { id: string; file: File; selected: boolean };

type Tokens = { inputTokens: number; outputTokens: number; totalTokens: number } | null;

type UploadContextValue = {
  files: SelectedFile[];
  setFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
  isLoading: boolean;
  progressById: Record<string, number>;
  error: string | null;
  analysisMode: "summary" | "detail";
  setAnalysisMode: (m: "summary" | "detail") => void;
  hint: string;
  setHint: (v: string) => void;
  resultsById: Record<string, string>;
  tokensById: Record<string, Tokens>;
  previewUrlsById: Record<string, string>;
  videoMetaById: Record<string, { duration: number; width: number; height: number }>;
  setVideoMeta: (id: string, meta: { duration: number; width: number; height: number }) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileInput: (files: FileList | null) => void;
  handleAnalyze: () => Promise<void>;
  clearAll: () => void;
};

const UploadContext = React.createContext<UploadContextValue | null>(null);

export function useUpload() {
  const ctx = React.useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n();
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [resultsById, setResultsById] = React.useState<Record<string, string>>({});
  const [tokensById, setTokensById] = React.useState<Record<string, Tokens>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [progressById, setProgressById] = React.useState<Record<string, number>>({});
  const [previewUrlsById, setPreviewUrlsById] = React.useState<Record<string, string>>({});
  const [videoMetaById, setVideoMetaById] = React.useState<Record<string, { duration: number; width: number; height: number }>>({});
  const [analysisMode, setAnalysisMode] = React.useState<"summary" | "detail">("detail");
  const [hint, setHint] = React.useState("");

  React.useEffect(() => {
    const selected = files.filter((f) => f.selected);
    const urls: Record<string, string> = {};
    for (const sf of selected) urls[sf.id] = URL.createObjectURL(sf.file);
    setPreviewUrlsById(urls);
    return () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("video/"));
    if (dropped.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...dropped.map((f, idx) => ({ id: `${f.name}_${Date.now()}_${idx}`, file: f, selected: true })),
    ]);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleFileInput(list: FileList | null) {
    const picked = Array.from(list || []).filter((f) => f.type.startsWith("video/"));
    if (picked.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...picked.map((f, idx) => ({ id: `${f.name}_${Date.now()}_${idx}`, file: f, selected: true })),
    ]);
  }

  async function handleAnalyze() {
    setError(null);
    const targets = files.filter((f) => f.selected);
    if (targets.length === 0) throw new Error(t("noSelectionError"));
    // Clear only results/tokens for targets to avoid wiping past analyses
    setResultsById((prev) => {
      const next = { ...prev } as Record<string, string>;
      for (const sf of targets) delete next[sf.id];
      return next;
    });
    setTokensById((prev) => {
      const next = { ...prev } as Record<string, Tokens>;
      for (const sf of targets) delete next[sf.id];
      return next;
    });
    setIsLoading(true);
    try {
      for (let i = 0; i < targets.length; i++) {
        const sf = targets[i];
        setProgressById((prev) => ({ ...prev, [sf.id]: 0 }));
        const largeThreshold = CHUNK_THRESHOLD_BYTES;
        let uploadId: string | null = null;
        if (sf.file.size > largeThreshold) {
          // Resumable upload: init
          const initFd = new FormData();
          initFd.append("fileName", sf.file.name);
          initFd.append("size", String(sf.file.size));
          initFd.append("chunkSize", String(5 * 1024 * 1024));
          const initRes = await fetch("/api/uploads/init", { method: "POST", body: initFd });
          if (!initRes.ok) throw new Error("init upload failed");
          const initJson = (await initRes.json()) as { ok?: boolean; uploadId: string; chunkSize: number };
          uploadId = initJson.uploadId;
          const chunkSize = initJson.chunkSize;
          const total = Math.ceil(sf.file.size / chunkSize);
          for (let idx = 0; idx < total; idx++) {
            const start = idx * chunkSize;
            const end = Math.min(sf.file.size, start + chunkSize);
            const blob = sf.file.slice(start, end);
            const fd = new FormData();
            fd.append("uploadId", uploadId);
            fd.append("index", String(idx));
            fd.append("blob", blob);
            let ok = false;
            for (let attempt = 0; attempt < 3 && !ok; attempt++) {
              const r = await fetch("/api/uploads/append", { method: "POST", body: fd });
              if (r.ok) ok = true;
              else if (r.status === 409) { const j = await r.json(); if (j.expected !== idx) { idx = j.expected - 1; break; } }
              else if (attempt === 2) throw new Error("append failed");
            }
            setProgressById((prev) => ({ ...prev, [sf.id]: Math.round(((idx + 1) / total) * 20) })); // reserve 0-20% for upload
          }
          const cfd = new FormData(); cfd.append("uploadId", uploadId);
          const comp = await fetch("/api/uploads/complete", { method: "POST", body: cfd });
          if (!comp.ok) throw new Error("complete upload failed");
        }
        // Analysis
        const form = new FormData();
        if (uploadId) form.append("uploadId", uploadId);
        else form.append("file", sf.file);
        form.append("fileName", sf.file.name);
        form.append("mode", analysisMode);
        form.append("lang", lang);
        if (hint && hint.trim()) form.append("hint", hint.trim());
        const res = await fetch("/api/explain/stream", { method: "POST", body: form });
        if (!res.ok || !res.body) {
          const json: unknown = await res.json().catch(() => ({} as unknown));
          const hasErrKey = typeof json === "object" && json !== null && Object.prototype.hasOwnProperty.call(json as Record<string, unknown>, "error");
          const errVal = hasErrKey ? (json as Record<string, unknown>)["error"] : undefined;
          const errMsg = typeof errVal === "string" ? errVal : "stream error";
          throw new Error(errMsg);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        let tokens: Tokens = null;
        let buffer = ""; // NDJSON バッファ（チャンク跨ぎ対策）
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          while (true) {
            const nl = buffer.indexOf("\n");
            if (nl === -1) break; // 行が閉じていない
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (!line.trim()) continue;
            try {
              const parsed: unknown = JSON.parse(line);
              const mk = parsed as { kind?: unknown };
              if (mk && typeof mk.kind === "string") {
                const evt = parsed as StreamEvent;
                switch (evt.kind) {
                  case "progress":
                    if (typeof evt.progress === "number") setProgressById((prev) => ({ ...prev, [sf.id]: Math.max(20, Math.min(100, evt.progress)) }));
                    break;
                  case "delta":
                    if (typeof evt.progress === "number") setProgressById((prev) => ({ ...prev, [sf.id]: Math.max(20, Math.min(100, evt.progress)) }));
                    if ((evt as { delta?: string }).delta) full += (evt as { delta?: string }).delta as string;
                    break;
                  case "done":
                    setProgressById((prev) => ({ ...prev, [sf.id]: 100 }));
                    if (typeof evt.text === "string" && evt.text.length > 0) {
                      full = evt.text; // サーバー側の最終テキストで上書き
                    }
                    if (evt.tokens !== undefined) tokens = evt.tokens as Tokens;
                    break;
                  case "error":
                    throw new Error(((evt as unknown) as { error?: { message?: string } })?.error?.message || "processing error");
                }
              } else {
                const evt = parsed as { progress?: number; delta?: string; text?: string; tokens?: Tokens; error?: string };
                if (typeof evt.progress === "number") setProgressById((prev) => ({ ...prev, [sf.id]: Math.max(20, Math.min(100, evt.progress!)) }));
                if (typeof evt.delta === "string") full += evt.delta;
                if (typeof evt.text === "string" && evt.text.length > 0) full = evt.text;
                if (evt.tokens !== undefined) tokens = evt.tokens as Tokens;
                if (typeof evt.error === "string") throw new Error(evt.error);
              }
            } catch {
              // 解析失敗は黙ってスキップ（次の行で回復）
            }
          }
        }
        // 残りのバッファを最終処理（末尾に改行が付かないケース）
        if (buffer.trim()) {
          try {
            const parsed: unknown = JSON.parse(buffer.trim());
            const mk = parsed as { kind?: unknown };
            if (mk && typeof mk.kind === "string") {
              const evt = parsed as StreamEvent;
              if (evt.kind === "delta" && (evt as { delta?: string }).delta) full += (evt as { delta?: string }).delta as string;
              if (evt.kind === "done") {
                if (typeof evt.text === "string" && evt.text.length > 0) full = evt.text;
                if (evt.tokens !== undefined) tokens = evt.tokens as Tokens;
              }
            }
          } catch {}
        }
        setResultsById((prev) => ({ ...prev, [sf.id]: full }));
        setTokensById((prev) => ({ ...prev, [sf.id]: tokens }));
        setProgressById((prev) => ({ ...prev, [sf.id]: 100 }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setIsLoading(false);
    }
  }

  function clearAll() {
    setFiles([]);
    setResultsById({});
    setTokensById({});
    setError(null);
    setProgressById({});
    setVideoMetaById({});
    setPreviewUrlsById({});
  }

  const value: UploadContextValue = {
    files,
    setFiles,
    isLoading,
    progressById,
    error,
    analysisMode,
    setAnalysisMode,
    hint,
    setHint,
    resultsById,
    tokensById,
    previewUrlsById,
    videoMetaById,
    setVideoMeta: (id, meta) => setVideoMetaById((prev) => ({ ...prev, [id]: meta })),
    handleDrop,
    handleDragOver,
    handleFileInput,
    handleAnalyze,
    clearAll,
  };

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}
