"use client";

import * as React from "react";
import { CHUNK_THRESHOLD_BYTES } from "@/config";
import { useI18n } from "@/components/i18n-context";
import type { ParsedContent } from "@/lib/parse-content";
import type { Phase, StreamEvent } from "@/types/progress";

export type SelectedFile = { id: string; file: File; selected: boolean };
export type Tokens = { inputTokens: number; outputTokens: number; totalTokens: number } | null;
export type FileState = {
  progress: number;
  phase: "idle" | "uploading" | Phase;
  message?: string;
  error?: string;
};

type UploadContextValue = {
  files: SelectedFile[];
  setFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
  removeFile: (id: string) => void;
  isLoading: boolean;
  fileStatesById: Record<string, FileState | undefined>;
  error: string | null;
  analysisMode: "summary" | "detail";
  setAnalysisMode: (m: "summary" | "detail") => void;
  hint: string;
  setHint: (v: string) => void;
  resultsById: Record<string, ParsedContent>;
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

const IDLE_STATE: FileState = { progress: 0, phase: "idle" };

export function useUpload() {
  const ctx = React.useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { t, lang } = useI18n();
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [resultsById, setResultsById] = React.useState<Record<string, ParsedContent>>({});
  const [tokensById, setTokensById] = React.useState<Record<string, Tokens>>({});
  const [fileStatesById, setFileStatesById] = React.useState<Record<string, FileState | undefined>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrlsById, setPreviewUrlsById] = React.useState<Record<string, string>>({});
  const [videoMetaById, setVideoMetaById] = React.useState<Record<string, { duration: number; width: number; height: number }>>({});
  const [analysisMode, setAnalysisMode] = React.useState<"summary" | "detail">("detail");
  const [hint, setHint] = React.useState("");

  React.useEffect(() => {
    const selected = files.filter((file) => file.selected);
    const needed = new Set(selected.map((file) => file.id));

    setPreviewUrlsById((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!needed.has(id)) {
          URL.revokeObjectURL(next[id]);
          delete next[id];
        }
      }
      for (const file of selected) {
        if (!next[file.id]) {
          next[file.id] = URL.createObjectURL(file.file);
        }
      }
      return next;
    });
  }, [files]);

  React.useEffect(() => {
    return () => {
      setPreviewUrlsById((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
    };
  }, []);

  function setFileState(id: string, next: Partial<FileState>) {
    setFileStatesById((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || IDLE_STATE),
        ...next,
      },
    }));
  }

  function clearPerFileState(id: string, options?: { keepVideoMeta?: boolean }) {
    setResultsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTokensById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFileStatesById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (!options?.keepVideoMeta) {
      setVideoMetaById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function addVideoFiles(list: FileList | File[]) {
    const videos = Array.from(list).filter((file) => file.type.startsWith("video/"));
    if (videos.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...videos.map((file, idx) => ({ id: `${file.name}_${Date.now()}_${idx}`, file, selected: true })),
    ]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    clearPerFileState(id);
    setPreviewUrlsById((prev) => {
      const next = { ...prev };
      if (next[id]) URL.revokeObjectURL(next[id]);
      delete next[id];
      return next;
    });
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

  async function analyzeFile(file: SelectedFile) {
    let uploadId: string | null = null;
    if (file.file.size > CHUNK_THRESHOLD_BYTES) {
      const initFd = new FormData();
      initFd.append("fileName", file.file.name);
      initFd.append("size", String(file.file.size));
      initFd.append("chunkSize", String(5 * 1024 * 1024));
      const initRes = await fetch("/api/uploads/init", { method: "POST", body: initFd });
      if (!initRes.ok) throw new Error("init upload failed");
      const initJson = (await initRes.json()) as { uploadId: string; chunkSize: number };
      uploadId = initJson.uploadId;
      const chunkSize = initJson.chunkSize;
      const total = Math.ceil(file.file.size / chunkSize);

      for (let idx = 0; idx < total; idx++) {
        const start = idx * chunkSize;
        const end = Math.min(file.file.size, start + chunkSize);
        const blob = file.file.slice(start, end);
        const fd = new FormData();
        fd.append("uploadId", uploadId);
        fd.append("index", String(idx));
        fd.append("blob", blob);

        setFileState(file.id, {
          phase: "uploading",
          progress: Math.round((idx / total) * 20),
          message: t("uploadChunkStatus", idx + 1, total),
          error: undefined,
        });

        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          const response = await fetch("/api/uploads/append", { method: "POST", body: fd });
          if (response.ok) {
            ok = true;
          } else if (response.status === 409) {
            const json = await response.json();
            if (json.expected !== idx) {
              idx = json.expected - 1;
              break;
            }
          } else if (attempt === 2) {
            throw new Error("append failed");
          }
        }

        setFileState(file.id, {
          progress: Math.round(((idx + 1) / total) * 20),
          message: t("uploadChunkStatus", idx + 1, total),
        });
      }

      const completeFd = new FormData();
      completeFd.append("uploadId", uploadId);
      const completeRes = await fetch("/api/uploads/complete", { method: "POST", body: completeFd });
      if (!completeRes.ok) throw new Error("complete upload failed");
    }

    const form = new FormData();
    if (uploadId) form.append("uploadId", uploadId);
    else form.append("file", file.file);
    form.append("fileName", file.file.name);
    form.append("mode", analysisMode);
    form.append("lang", lang);
    if (hint.trim()) form.append("hint", hint.trim());

    const res = await fetch("/api/explain/stream", { method: "POST", body: form });
    if (!res.ok || !res.body) {
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const errMsg = typeof json.error === "string" ? json.error : "stream error";
      throw new Error(errMsg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result: ParsedContent | null = null;
    let tokens: Tokens = null;

    const updateProgress = (progress: number) => {
      const clamped = Math.max(20, Math.min(100, progress));
      setFileState(file.id, { progress: clamped });
    };

    const handleLine = (line: string) => {
      if (!line.trim()) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      const raw = parsed as Record<string, unknown>;
      if (typeof raw.kind !== "string") return;

      const evt = parsed as StreamEvent;
      switch (evt.kind) {
        case "progress":
          if (typeof evt.progress === "number") updateProgress(evt.progress);
          setFileState(file.id, {
            phase: evt.phase,
            message: evt.message,
            error: undefined,
          });
          break;
        case "done":
          result = evt.result;
          tokens = evt.tokens ?? null;
          setFileState(file.id, {
            phase: "done",
            progress: 100,
            message: t("analysisDone"),
            error: undefined,
          });
          break;
        case "error":
          throw new Error(evt.error.message || "processing error");
        case "delta":
          break;
      }
    };

    let buffer = "";
    const drain = () => {
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
      drain();
    }
    buffer += decoder.decode();
    drain();
    if (buffer.trim()) handleLine(buffer.trim());

    if (!result) throw new Error(t("emptyResultError"));
    setResultsById((prev) => ({ ...prev, [file.id]: result! }));
    setTokensById((prev) => ({ ...prev, [file.id]: tokens }));
  }

  async function handleAnalyze() {
    setError(null);
    const targets = files.filter((file) => file.selected);
    if (targets.length === 0) {
      setError(t("noSelectionError"));
      return;
    }

    for (const file of targets) {
      clearPerFileState(file.id, { keepVideoMeta: true });
      setFileState(file.id, { ...IDLE_STATE });
    }

    setIsLoading(true);
    let failedCount = 0;
    try {
      for (const file of targets) {
        try {
          await analyzeFile(file);
        } catch (err) {
          failedCount += 1;
          const message = err instanceof Error ? err.message : t("genericError");
          setFileState(file.id, {
            phase: "error",
            error: message,
            message,
          });
        }
      }
    } finally {
      setIsLoading(false);
      setError(failedCount > 0 ? t("fileFailuresSummary", failedCount, targets.length) : null);
    }
  }

  function clearAll() {
    setFiles([]);
    setResultsById({});
    setTokensById({});
    setFileStatesById({});
    setError(null);
    setVideoMetaById({});
    setPreviewUrlsById((prev) => {
      Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
      return {};
    });
  }

  const value: UploadContextValue = {
    files,
    setFiles,
    removeFile,
    isLoading,
    fileStatesById,
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
