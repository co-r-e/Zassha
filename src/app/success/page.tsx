"use client";
import * as React from "react";
import Link from "next/link";
import ParsedResult from "@/components/parsed-result";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-context";

export default function SuccessPage() {
  const { t } = useI18n();
  const [status, setStatus] = React.useState<"idle" | "queued" | "done" | "error">("idle");
  const [text, setText] = React.useState<string>("");
  const [message, setMessage] = React.useState<string>("");
  const [uploadId, setUploadId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number>(0);

  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const u = sp.get("uploadId");
    if (!u) return;
    async function run() {
      try {
        setUploadId(u);
        setStatus("queued");
        const poll = async () => {
          const r = await fetch(`/api/result?uploadId=${u}`).then((x) => x.json());
          if (r?.status === "done") {
            setText(r.text as string);
            setStatus("done");
            return true;
          }
          if (r?.status === "queued" && typeof r.progress === "number") {
            setStatus("queued");
            setProgress(Math.max(0, Math.min(100, r.progress as number)));
            const phaseLabels: Record<string, string> = {
              starting: t("overview"),
              "uploading-to-gemini": "Gemini",
              "waiting-active": "Waiting",
              generating: t("analysisResult"),
              "building-attachments": "Docs",
              error: t("errorOccurred"),
              done: "Done",
            };
            const label = phaseLabels[r.phase as string] || "";
            setMessage(`${t("inProgressPrefix")}${label ? ": " + label : ""} (${r.progress}%)`);
          }
          return false;
        };
        if (!(await poll())) {
          const start = Date.now();
          const timeoutMs = 4 * 60 * 1000;
          const intervalMs = 2500;
          const timer = setInterval(async () => {
            if (Date.now() - start > timeoutMs) {
              clearInterval(timer);
              setStatus("error");
              setMessage(t("timeout"));
              return;
            }
            const done = await poll();
            if (done) clearInterval(timer);
          }, intervalMs);
        }
      } catch {
        setStatus("error");
        setMessage(t("fetchError"));
      }
    }
    void run();
  }, [t]);

  return (
    <div className="min-h-dvh flex items-start justify-center">
      <div className="w-full max-w-[900px] space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t("processingDone")}</h1>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline">{t("goHome")}</Button>
            </Link>
            {/* 履歴機能は廃止 */}
          </div>
        </div>

        {status === "queued" && (
          <div className="border border-border rounded-md p-4 text-sm text-muted-foreground">
            <div className="mb-2">{message || t("queuedMessage")}</div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground animate-[progress-stripes_1s_linear_infinite]"
                style={{ width: `${Math.max(10, Math.min(98, progress || 0))}%` }}
              />
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="border border-destructive rounded-md p-4 text-sm text-destructive">
            {message || t("errorOccurred")}
          </div>
        )}
        {status === "done" && (
          <div className="border border-border rounded-md p-4 bg-card">
            <ParsedResult source={text} />
            {uploadId && (
              <div className="mt-3 flex gap-2">
                <a className="text-xs underline" href={`/api/result/download?uploadId=${uploadId}&type=docx`}>{t("downloadWord")}</a>
                <a className="text-xs underline" href={`/api/result/download?uploadId=${uploadId}&type=xlsx`}>{t("downloadExcel")}</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
