"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileVideo, Timer, Maximize2, HardDrive, Trash2, NotebookPen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import ParsedResult from "@/components/parsed-result";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";

type SelectedFile = { id: string; file: File; selected: boolean };

export default function Home() {
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [resultsById, setResultsById] = React.useState<Record<string, string>>({});
  const [tokensById, setTokensById] = React.useState<Record<string, { inputTokens: number; outputTokens: number; totalTokens: number } | null>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number>(0);
  const [previewUrlsById, setPreviewUrlsById] = React.useState<Record<string, string>>({});
  const [videoMetaById, setVideoMetaById] = React.useState<Record<string, { duration: number; width: number; height: number }>>({});
  const [exporting] = React.useState(false);
  const [analysisMode, setAnalysisMode] = React.useState<"summary" | "detail">("detail");
  // split feature removed; no notices or temp uploads

  function parseContentForExport(markdown: string) {
    const lines = markdown.split(/\r?\n/);
    let overview = "";
    let duration = "";
    let businessInference = "";
    const steps: Array<{ stepName: string; operations: string[]; stepInference?: string }> = [];
    
    let currentSection = "";
    let currentStep: { stepName: string; operations: string[]; stepInference?: string } | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith("## 概要")) {
        currentSection = "overview";
        continue;
      } else if (trimmed.startsWith("## 所要時間")) {
        currentSection = "duration";
        continue;
      } else if (trimmed.startsWith("## 業務推察")) {
        currentSection = "businessInference";
        continue;
      } else if (trimmed.startsWith("## 業務詳細")) {
        currentSection = "businessDetails";
        continue;
      } else if (trimmed.startsWith("### ")) {
        if (currentStep) steps.push(currentStep);
        const stepName = trimmed.replace(/^### /, "").replace(/^ステップ\d+:\s*/, "");
        currentStep = { stepName, operations: [] };
        continue;
      }
      
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      switch (currentSection) {
        case "overview":
          if (!overview) overview = trimmed.replace(/^\[|\]$/g, "");
          break;
        case "duration":
          if (!duration) duration = trimmed.replace(/^\[|\]$/g, "");
          break;
        case "businessInference":
          if (!businessInference) businessInference = trimmed.replace(/^\[|\]$/g, "");
          break;
        case "businessDetails":
          if (trimmed.startsWith("- ") && currentStep) {
            currentStep.operations.push(trimmed.substring(2));
          } else if (trimmed.startsWith("**業務推察:**") && currentStep) {
            currentStep.stepInference = trimmed.replace(/^\*\*業務推察:\*\*\s*/, "");
          }
          break;
      }
    }
    
    if (currentStep) steps.push(currentStep);
    
    return { overview, duration, businessInference, steps };
  }

  async function exportAsExcel(name: string, markdown: string) {
    const content = parseContentForExport(markdown);
    const rows: string[][] = [
      ["項目", "内容"],
      ["概要", content.overview],
      ["所要時間", content.duration],
      ["業務推察", content.businessInference],
      ["", ""], // 空行
      ["ステップ", "操作詳細", "業務推察"]
    ];
    
    content.steps.forEach(step => {
      rows.push([step.stepName, "", step.stepInference || ""]);
      step.operations.forEach(op => {
        rows.push(["", op, ""]);
      });
    });
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Result");
    const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/\.[^/.]+$/, "")}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportAsWord(name: string, markdown: string) {
    const content = parseContentForExport(markdown);
    const children: (Paragraph | Table)[] = [
      new Paragraph({ text: name, spacing: { after: 200 } }),
      new Paragraph({ text: "概要: " + content.overview, spacing: { after: 100 } }),
      new Paragraph({ text: "所要時間: " + content.duration, spacing: { after: 100 } }),
      new Paragraph({ text: "業務推察: " + content.businessInference, spacing: { after: 200 } }),
      new Paragraph({ text: "業務詳細", spacing: { after: 100 } })
    ];
    
    content.steps.forEach(step => {
      children.push(new Paragraph({ text: step.stepName, spacing: { after: 50 } }));
      step.operations.forEach(op => {
        children.push(new Paragraph({ text: "• " + op, spacing: { after: 50 } }));
      });
      if (step.stepInference) {
        children.push(new Paragraph({ text: "業務推察: " + step.stepInference, spacing: { after: 100 } }));
      }
    });
    
    const doc = new Document({ sections: [{ properties: {}, children }] });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/\.[^/.]+$/, "")}.docx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function ExportMenu({ fileName, markdown }: { fileName: string; markdown: string }) {
  return (
      <div className="flex items-center gap-2 text-xs">
        <button
          className="rounded border border-border bg-card text-foreground px-2 py-1 hover:bg-muted transition-colors"
          onClick={() => exportAsWord(fileName, markdown)}
          disabled={exporting}
        >
          Word
        </button>
        <button
          className="rounded border border-border bg-card text-foreground px-2 py-1 hover:bg-muted transition-colors"
          onClick={() => exportAsExcel(fileName, markdown)}
          disabled={exporting}
        >
          Excel
        </button>
      </div>
    );
  }

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
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    const decimals = size >= 10 ? 0 : 1;
    return `${size.toFixed(decimals)} ${units[unitIndex]}`;
  }

  // 履歴機能は廃止

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResultsById({});
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      setProgress(0);
      const targets = files.filter((f) => f.selected);
      if (targets.length === 0) {
        throw new Error("解析対象が選択されていません");
      }
      for (let i = 0; i < targets.length; i++) {
        const sf = targets[i];
        const form = new FormData();
        form.append("file", sf.file);
        form.append("mode", analysisMode);
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
        let tokens: { inputTokens: number; outputTokens: number; totalTokens: number } | null = null;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.progress !== undefined) setProgress(Math.max(0, Math.min(100, evt.progress)));
              if (evt.delta) full += evt.delta as string;
              if (evt.text) full = evt.text as string;
              if (evt.tokens) tokens = evt.tokens;
              if (evt.error) throw new Error(evt.error);
            } catch {}
          }
        }
        // streamingはMarkdown。受け取った全文を保存
        const finalText = full;
        setResultsById((prev) => ({ ...prev, [sf.id]: finalText }));
        setTokensById((prev) => ({ ...prev, [sf.id]: tokens }));

        // 履歴保存は廃止
      }
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("video/"));
    if (dropped.length === 0) return;
    setFiles((prev) => [
      ...prev,
                      ...dropped.map((f, idx) => ({ id: `${f.name}_${idx}`, file: f, selected: true })),
    ]);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  React.useEffect(() => {
    // Generate object URLs for selected files
    const selected = files.filter((f) => f.selected);
    const urls: Record<string, string> = {};
    for (const sf of selected) {
      urls[sf.id] = URL.createObjectURL(sf.file);
    }
    setPreviewUrlsById(urls);
    return () => {
      for (const id of Object.keys(urls)) URL.revokeObjectURL(urls[id]);
    };
  }, [files]);

  // progress is now driven by server streaming events only

  const outerClass = "min-h-dvh flex justify-start items-start overflow-x-auto";
  const innerClass = "w-full min-w-[1600px] max-w-none grid gap-6 lg:grid-cols-[420px_1fr] px-4";

  // split feature removed


  return (
    <div className={outerClass}>
      <div className={innerClass}>
        {/* Left Column: Upload + Preview (stacked) */}
        <div className={"lg:col-span-1 space-y-6"}>
          {/* split notices removed */}
          <form onSubmit={handleSubmit}>
            <div className="relative border border-border rounded-2xl bg-background p-4">
              <div className="text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-foreground" aria-hidden />
                <h1 className="mt-2 text-lg font-semibold">動画をアップロード</h1>
                {/* 説明文は下の選択エリアに移動 */}
              </div>

              {/* Upload area */}

              <div onDrop={handleDrop} onDragOver={handleDragOver}>
                <label className="block cursor-pointer rounded-lg border border-dashed border-border p-6 text-center hover:bg-muted transition-colors">
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []).filter((f) => f.type.startsWith("video/"));
                      if (picked.length === 0) return;
                      setFiles((prev) => [
                        ...prev,
                        ...picked.map((f, idx) => ({ id: `${f.name}_${idx}`, file: f, selected: true })),
                      ]);
                      e.currentTarget.value = "";
                    }}
                    className="sr-only"
                  />
                  <span className="text-xs">ドラッグ＆ドロップ、またはクリックしてファイルを選択</span>
                </label>
                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((sf) => (
                      <div key={sf.id} className="flex items-center justify-between rounded-md border border-border bg-card px-2 py-1 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary cursor-pointer"
                            checked={sf.selected}
                            onChange={(e) =>
                              setFiles((prev) =>
                                prev.map((x) => (x.id === sf.id ? { ...x, selected: e.target.checked } : x))
                              )
                            }
                            aria-label="選択"
                            title="選択"
                          />
                          <span className="truncate max-w-[280px]">{sf.file.name}</span>
                        </div>
                        <button
                          type="button"
                          aria-label="削除"
                          className="ml-2 inline-flex items-center text-muted-foreground hover:text-primary"
                          onClick={() => setFiles((prev) => prev.filter((x) => x.id !== sf.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode("summary")}
                    className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                      analysisMode === "summary" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                    }`}
                    aria-pressed={analysisMode === "summary"}
                  >
                    概要
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode("detail")}
                    className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                      analysisMode === "detail" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
                    }`}
                    aria-pressed={analysisMode === "detail"}
                  >
                    詳細
                  </button>
                </div>
                {/* split button removed */}
                {(() => {
                  const isAnalyzeDisabled = isLoading || files.filter((f) => f.selected).length === 0;
                  return (
                <Button
                  type="submit"
                  disabled={isAnalyzeDisabled}
                  aria-label="解析"
                  variant="mesh"
                  className="relative overflow-hidden text-sm sm:text-base px-6 py-3 h-auto shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 [backdrop-filter:none] [filter:none]"
                  title={isAnalyzeDisabled ? "動画をアップロードしてください" : undefined}
                >
                  <span className="relative z-10 text-black dark:text-white font-bold">解析</span>
                  <span aria-hidden className="mesh-bg animate-pulse">
                    <span className="mesh-layer mesh-a opacity-90" />
                    <span className="mesh-layer mesh-b opacity-90" />
                    <span className="mesh-layer mesh-c opacity-90" />
                  </span>
                </Button>
                  );
                })()}
              </div>

              {isLoading && (
                <div className="mt-3">
                  <Progress value={progress} />
                  <div className="mt-1 text-[10px] text-muted-foreground">解析中...</div>
                </div>
              )}
              {error && (
                <div className="mt-3 text-xs text-destructive text-center">エラー: {error}</div>
              )}
              {(files.length > 0 || Object.keys(resultsById).length > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="リセット"
                  title="リセット"
                  className="absolute top-3 right-3 h-8 rounded-full border border-border bg-card text-foreground px-3 text-xs"
                  onClick={() => {
                    setFiles([]);
                    setResultsById({});
                    setTokensById({});
                    setError(null);
                  }}
                >
                  リセット
                </Button>
              )}
            </div>
          </form>

           <div className="border border-border rounded-2xl bg-background p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileVideo className="h-4 w-4 text-foreground" />
              <h2 className="font-semibold text-sm truncate">プレビュー</h2>
            </div>
            {files.some((f) => f.selected) && Object.keys(previewUrlsById).length > 0 ? (
              <div className="space-y-8">
                {files
                  .filter((f) => f.selected)
                  .map((sf) => (
                    <div key={sf.id} className="relative">
                      <div className="relative rounded-lg overflow-hidden bg-card border border-border">
                        <video
                          className="w-full h-auto block"
                          src={previewUrlsById[sf.id]}
                          controls
                          onLoadedMetadata={(e) => {
                            const v = e.currentTarget as HTMLVideoElement;
                            setVideoMetaById((prev) => ({
                              ...prev,
                              [sf.id]: { duration: v.duration, width: v.videoWidth, height: v.videoHeight },
                            }));
                          }}
                        />
                        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
                          <div className="inline-flex max-w-full items-center gap-2 rounded-md bg-foreground/60 px-2 py-1 text-[11px] text-background">
                            <span className="truncate">{sf.file.name}</span>
                          </div>
                        </div>
                      </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {videoMetaById[sf.id] ? formatDuration(videoMetaById[sf.id].duration) : "--:--"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                  <Maximize2 className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {videoMetaById[sf.id]
                              ? `${videoMetaById[sf.id].width}×${videoMetaById[sf.id].height}`
                              : "--×--"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3 text-muted-foreground" />
                          <span>{formatBytes(sf.file.size)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-6 bg-card text-center">
                アップロード後にここにプレビューが表示されます。
              </div>
            )}
          </div>
        </div>

        {/* Right: Explanation result column */}
        <div className="lg:col-span-1">
          <div className="p-0 h-full">
            <div className="flex items-center gap-2 p-2 mb-2">
              <NotebookPen className="h-4 w-4 text-primary" />
              <h2 className="font-semibold leading-none">解説結果</h2>
            </div>
            {files.length > 0 ? (
              <div className="space-y-4 overflow-x-auto">
                <div className="min-w-[1400px] pr-4 px-2 pb-6">
                  {files.map((sf) => (
                    <div key={sf.id} className="rounded-xl bg-card p-4 border border-border mb-4">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold mb-4 border-b border-border pb-3 text-primary">
                        <span className="truncate">{sf.file.name}</span>
                        {resultsById[sf.id] && (
                          <ExportMenu fileName={sf.file.name} markdown={resultsById[sf.id]} />
                        )}
                      </div>
                      {resultsById[sf.id] ? (
                        <ParsedResult source={resultsById[sf.id]} tokens={tokensById[sf.id]} />
                      ) : (
                        <div className="text-xs text-muted-foreground p-8 text-center border border-dashed border-border rounded-md bg-muted/20">
                          解析後にここに表示されます。
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="whitespace-pre-wrap border border-dashed border-border rounded-md p-6 bg-card min-h-40 text-muted-foreground min-w-[1200px] text-center flex items-center justify-center">
                  解析後にここに表示されます。
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// old markdown helpers removed (not used)
