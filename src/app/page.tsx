"use client";

import * as React from "react";
import ParsedResult from "@/components/parsed-result";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, Table } from "docx";
import { NotebookPen } from "lucide-react";
import { useUpload } from "@/components/upload-context";

function parseContentForExport(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  let overview = "";
  let duration = "";
  let businessInference = "";
  const steps: Array<{ stepName: string; operations: string[]; stepInference?: string; stepTool?: string }> = [];

  let currentSection = "";
  let currentStep: { stepName: string; operations: string[]; stepInference?: string; stepTool?: string } | null = null;

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
        if (trimmed.startsWith("**使用ツール:**") && currentStep) {
          currentStep.stepTool = trimmed.replace(/^\*\*使用ツール:\*\*\s*/, "");
        } else if (trimmed.startsWith("- ") && currentStep) {
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
    ["", ""],
    ["ステップ", "使用ツール", "操作詳細", "業務推察"],
  ];
  content.steps.forEach((step) => {
    rows.push([step.stepName, step.stepTool || "", "", step.stepInference || ""]);
    step.operations.forEach((op) => rows.push(["", "", op, ""]))
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
    new Paragraph({ text: "業務詳細", spacing: { after: 100 } }),
  ];
  content.steps.forEach((step) => {
    children.push(new Paragraph({ text: step.stepName, spacing: { after: 50 } }));
    if (step.stepTool) {
      children.push(new Paragraph({ text: "使用ツール: " + step.stepTool, spacing: { after: 50 } }));
    }
    step.operations.forEach((op) => children.push(new Paragraph({ text: "• " + op, spacing: { after: 50 } })));
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
  const [exporting] = React.useState(false);
  return (
    <div className="flex items-center gap-2 text-xs">
      <button className="rounded border border-border bg-card text-foreground px-2 py-1 hover:bg-muted transition-colors" onClick={() => exportAsWord(fileName, markdown)} disabled={exporting}>Word</button>
      <button className="rounded border border-border bg-card text-foreground px-2 py-1 hover:bg-muted transition-colors" onClick={() => exportAsExcel(fileName, markdown)} disabled={exporting}>Excel</button>
    </div>
  );
}

export default function Home() {
  const { files, resultsById, tokensById } = useUpload();

  return (
    <div className="min-h-dvh">
      <div className="p-0 h-full">
        <div className="flex items-center gap-2 p-2 mb-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          <h2 className="font-semibold leading-none">解説結果</h2>
        </div>
        {files.length > 0 ? (
          <div className="space-y-4 overflow-x-auto">
            <div className="min-w-[900px] pr-4 px-2 pb-6">
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
        ) : null}
      </div>
    </div>
  );
}
