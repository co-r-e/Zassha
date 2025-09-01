"use client";

import * as React from "react";
import { useI18n } from "@/components/i18n-context";

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
    setResultsById({});
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      const targets = files.filter((f) => f.selected);
      if (targets.length === 0) throw new Error(t("noSelectionError"));
      for (let i = 0; i < targets.length; i++) {
        const sf = targets[i];
        setProgressById((prev) => ({ ...prev, [sf.id]: 0 }));
        const form = new FormData();
        form.append("file", sf.file);
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
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line) as {
                progress?: number;
                delta?: string;
                text?: string;
                tokens?: Tokens;
                error?: string;
              };
              if (typeof evt.progress === "number")
                setProgressById((prev) => ({ ...prev, [sf.id]: Math.max(0, Math.min(100, evt.progress!)) }));
              if (typeof evt.delta === "string") full += evt.delta;
              if (typeof evt.text === "string") full = evt.text;
              if (evt.tokens !== undefined) tokens = evt.tokens as Tokens;
              if (typeof evt.error === "string") throw new Error(evt.error);
            } catch {}
          }
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
