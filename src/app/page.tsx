"use client";

import * as React from "react";
import ParsedResult from "@/components/parsed-result";
import { NotebookPen } from "lucide-react";
import { useUpload } from "@/components/upload-context";
import { useI18n } from "@/components/i18n-context";

export default function Home() {
  const { files, resultsById, tokensById } = useUpload();
  const { t } = useI18n();

  return (
    <div className="min-h-dvh">
      <div className="p-0 h-full">
        <div className="flex items-center gap-2 p-2 mb-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          <h2 className="font-semibold leading-none">{t("analysisResult")}</h2>
        </div>
        {files.length > 0 ? (
          <div className="space-y-4 overflow-x-auto">
            <div className="min-w-[900px] pr-4 px-2 pb-6">
              {files.map((sf) => (
                <div key={sf.id} className="rounded-xl bg-card p-4 mb-4">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold mb-4 pb-3 text-primary">
                    <span className="truncate">{sf.file.name}</span>
                  </div>
                  {resultsById[sf.id] ? (
                    <ParsedResult source={resultsById[sf.id]} tokens={tokensById[sf.id]} />
                  ) : (
                    <div className="text-xs text-muted-foreground p-8 text-center border border-dashed border-border rounded-md bg-muted/20">
                      {t("willShowAfterAnalysis")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
