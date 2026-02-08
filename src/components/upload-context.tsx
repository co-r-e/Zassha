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
    const needed = new Set(selected.map((sf) => sf.id));

    setPreviewUrlsById((prev) => {
      const next = { ...prev };
      // Revoke URLs no longer needed
      for (const id of Object.keys(next)) {
        if (!needed.has(id)) {
          URL.revokeObjectURL(next[id]);
          delete next[id];
        }
      }
      // Create URLs for newly selected files
      for (const sf of selected) {
        if (!next[sf.id]) {
          next[sf.id] = URL.createObjectURL(sf.file);
        }
      }
      return next;
    });
  }, [files]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      setPreviewUrlsById((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, []);

  function addVideoFiles(list: FileList | File[]) {
    const videos = Array.from(list).filter((f) => f.type.startsWith("video/"));
    if (videos.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...videos.map((f, idx) => ({ id: `${f.name}_${Date.now()}_${idx}`, file: f, selected: true })),
    ]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    addVideoFiles(Array.from(e.dataTransfer.files || []));
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleFileInput(list: FileList | null) {
    if (list) addVideoFiles(list);
  }

  async function handleAnalyze() {
    setError(null);
    const targets = files.filter((f) => f.selected);
    if (targets.length === 0) throw new Error(t("noSelectionError"));
    // Clear only results/tokens for targets to avoid wiping past analyses
    setResultsById((prev) => {
      const next = { ...prev };
      for (const sf of targets) delete next[sf.id];
      return next;
    });
    setTokensById((prev) => {
      const next = { ...prev };
      for (const sf of targets) delete next[sf.id];
      return next;
    });
    setIsLoading(true);
    try {
      for (let i = 0; i < targets.length; i++) {
        const sf = targets[i];
        setProgressById((prev) => ({ ...prev, [sf.id]: 0 }));
        let uploadId: string | null = null;
        if (sf.file.size > CHUNK_THRESHOLD_BYTES) {
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
          const json = await res.json().catch(() => ({})) as Record<string, unknown>;
          const errMsg = typeof json.error === "string" ? json.error : "stream error";
          throw new Error(errMsg);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        let tokens: Tokens = null;

        const clampProgress = (p: number) => Math.max(20, Math.min(100, p));
        const updateProgress = (p: number) =>
          setProgressById((prev) => ({ ...prev, [sf.id]: clampProgress(p) }));

        const handleLine = (line: string) => {
          if (!line.trim()) return;
          let parsed: unknown;
          try { parsed = JSON.parse(line); } catch { return; }

          const raw = parsed as Record<string, unknown>;
          if (typeof raw.kind === "string") {
            const evt = parsed as StreamEvent;
            switch (evt.kind) {
              case "progress":
                if (typeof evt.progress === "number") updateProgress(evt.progress);
                break;
              case "delta":
                if (typeof evt.progress === "number") updateProgress(evt.progress);
                if ("delta" in evt && typeof evt.delta === "string") full += evt.delta;
                break;
              case "done":
                setProgressById((prev) => ({ ...prev, [sf.id]: 100 }));
                if (typeof evt.text === "string" && evt.text.length > 0) full = evt.text;
                if (evt.tokens !== undefined) tokens = evt.tokens as Tokens;
                break;
              case "error": {
                const errEvt = evt as unknown as { error?: { message?: string } };
                throw new Error(errEvt?.error?.message || "processing error");
              }
            }
          } else {
            if (typeof raw.progress === "number") updateProgress(raw.progress);
            if (typeof raw.delta === "string") full += raw.delta;
            if (typeof raw.text === "string" && raw.text.length > 0) full = raw.text;
            if (raw.tokens !== undefined) tokens = raw.tokens as Tokens;
            if (typeof raw.error === "string") throw new Error(raw.error);
          }
        };

        let buffer = "";
        const drainLines = () => {
          let nl = buffer.indexOf("\n");
          while (nl !== -1) {
            handleLine(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
            nl = buffer.indexOf("\n");
          }
        };
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          drainLines();
        }
        buffer += decoder.decode();
        drainLines();
        if (buffer.trim()) handleLine(buffer.trim());
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
