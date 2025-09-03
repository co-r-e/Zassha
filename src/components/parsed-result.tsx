"use client";

import * as React from "react";
import { Clock, Eye, List } from "lucide-react";
import { useI18n, tCount } from "@/components/i18n-context";

type ParsedContent = {
  overview?: string;
  duration?: string;
  businessInference?: string;
  businessDetails?: Array<{
    stepName: string;
    operations: string[];
    stepTool?: string;
    stepInference?: string;
  }>;
};

function parseTwoColTable(md: string): Array<{ task: string; detail: string }> {
  const lines = md.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => {
    if (!l.includes("|")) return false;
    const low = l.toLowerCase();
    return (
      (low.includes("business task") && low.includes("business details")) ||
      (l.includes("業務工程") && l.includes("業務詳細"))
    );
  });
  if (headerIdx < 0) return [];
  const rows: Array<{ task: string; detail: string }> = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const L = lines[i];
    if (!L.includes("|")) {
      // stop when table ends (first non-table line after header separator)
      if (rows.length > 0) break;
      continue;
    }
    const cells = L.split("|").map((s) => s.trim());
    if (cells.length < 4) continue;
    const task = cells[1] || "";
    const detail = cells[2] || "";
    if (task || detail) rows.push({ task, detail });
  }
  return rows;
}

function parseMarkdownContent(md: string): ParsedContent {
  const lines = md.split(/\r?\n/);
  const result: ParsedContent = {
    businessDetails: []
  };

  let currentSection = "";
  let currentStep: { stepName: string; operations: string[]; stepInference?: string; stepTool?: string } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## 概要") || trimmed.toLowerCase().startsWith("## overview")) {
      currentSection = "overview";
      continue;
    } else if (trimmed.startsWith("## 所要時間") || trimmed.toLowerCase().startsWith("## duration")) {
      currentSection = "duration";
      continue;
    } else if (trimmed.startsWith("## 業務推察") || trimmed.toLowerCase().startsWith("## business inference")) {
      currentSection = "businessInference";
      continue;
    } else if (trimmed.startsWith("## 業務詳細") || trimmed.toLowerCase().startsWith("## business details")) {
      currentSection = "businessDetails";
      continue;
    } else if (trimmed.startsWith("### ")) {
      // Save previous step if exists
      if (currentStep) {
        result.businessDetails!.push(currentStep);
      }
      // Start new step
      const stepName = trimmed
        .replace(/^### /, "")
        .replace(/^ステップ\d+:\s*/, "")
        .replace(/^step\s*\d+:\s*/i, "");
      currentStep = { stepName, operations: [] };
      continue;
    }

    if (!trimmed) continue;

    switch (currentSection) {
      case "overview":
        if (!result.overview && !trimmed.startsWith("#")) {
          result.overview = trimmed.replace(/^\[|\]$/g, "");
        }
        break;
      case "duration":
        if (!result.duration && !trimmed.startsWith("#")) {
          result.duration = trimmed.replace(/^\[|\]$/g, "");
        }
        break;
      case "businessInference":
        if (!result.businessInference && !trimmed.startsWith("#")) {
          result.businessInference = trimmed.replace(/^\[|\]$/g, "");
        }
        break;
      case "businessDetails":
        if ((/^\*\*使用ツール:\*\*/.test(trimmed) || /^\*\*used tool:\*\*/i.test(trimmed)) && currentStep) {
          currentStep.stepTool = trimmed.replace(/^\*\*使用ツール:\*\*\s*/, "");
          currentStep.stepTool = currentStep.stepTool.replace(/^\*\*used tool:\*\*\s*/i, "");
        } else if (trimmed.startsWith("- ") && currentStep) {
          currentStep.operations.push(trimmed.substring(2));
        } else if ((/^\*\*業務推察:\*\*/.test(trimmed) || /^\*\*business inference:\*\*/i.test(trimmed)) && currentStep) {
          currentStep.stepInference = trimmed.replace(/^\*\*業務推察:\*\*\s*/, "");
          currentStep.stepInference = currentStep.stepInference.replace(/^\*\*business inference:\*\*\s*/i, "");
        }
        break;
    }
  }

  // Save last step if exists
  if (currentStep) {
    result.businessDetails!.push(currentStep);
  }

  return result;
}

export default function ParsedResult({
  source,
  tokens
}: {
  source: string;
  tokens?: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
}) {
  const { t, lang } = useI18n();
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(new Set());
  const [isMounted, setIsMounted] = React.useState(false);
  const content = React.useMemo(() => parseMarkdownContent(source), [source]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  // If section parsing failed, try 2-col Markdown table (Business Task | Business Details)
  const tableRows = React.useMemo(() => parseTwoColTable(source), [source]);
  if (!content.overview && !content.businessDetails?.length && tableRows.length > 0) {
    return (
      <div className="w-full">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <List className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{t("businessDetails")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-12">No.</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-56">{t("stepName")}</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30">{t("businessDetails")}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="p-3 align-top">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">{i + 1}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="text-xs font-medium text-foreground leading-relaxed">{r.task || t("unknown")}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{r.detail || ""}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // If parsing still failed, show raw content
  if (!content.overview && !content.businessDetails?.length) {
    return (
      <div className="text-xs text-muted-foreground">
        {t("unrecognizedFormat")}
        <pre className="mt-2 whitespace-pre-wrap text-[12px] border border-border rounded-md p-3 bg-card">{source}</pre>
      </div>
    );
  }

  return (
    <div className="w-full min-w-[1100px]">
      {/* Header Section - Horizontal Layout */}
      <div className="rounded-md border border-border bg-card mb-4">
        <div className="p-4">
          <div className="grid grid-cols-[400px_400px_200px] gap-6 items-start">
            {/* Overview with Duration */}
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">{t("overview")}</div>
              <div className="text-xs text-foreground leading-relaxed mb-2">
                {content.overview || t("noOverview")}
              </div>
              {content.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">{content.duration}</span>
                </div>
              )}
            </div>

            {/* Business Inference */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Eye className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground">{t("businessInference")}</span>
              </div>
              <div className="text-xs text-foreground leading-relaxed">
                {content.businessInference || t("noInference")}
              </div>
            </div>

            {/* Token Usage */}
            {tokens && (
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground mb-2">{t("tokenUsage")}</div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("input")}:</span>
                    <span className="text-foreground font-medium">{tokens.inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("output")}:</span>
                    <span className="text-foreground font-medium">{tokens.outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span className="text-muted-foreground">{t("total")}:</span>
                    <span className="text-foreground font-medium">{tokens.totalTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>

      {/* Business Details Section - Table Layout */}
      {content.businessDetails && content.businessDetails.length > 0 && (
        <div className="rounded-md border border-border bg-card">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <List className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{t("businessDetails")}</span>
            </div>

            {/* Table Layout */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-12">No.</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-56">{t("stepName")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-44">{t("usedTool")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-80">{t("operations")}</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-96">{t("stepInference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {content.businessDetails.map((step, index) => (
                    <tr
                      key={index}
                      className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => toggleStep(index)}
                      title={isMounted && expandedSteps.has(index) ? t("collapseHint") : t("expandHint")}
                    >
                      <td className="p-3 align-top">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="text-xs font-medium text-foreground leading-relaxed">
                          {step.stepName}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="text-xs text-foreground leading-relaxed">
                          {step.stepTool || t("unknown")}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        {isMounted && expandedSteps.has(index) ? (
                          <div className="space-y-2">
                            {step.operations.map((operation, opIndex) => (
                              <div key={opIndex} className="flex items-start gap-2">
                                <span className="text-primary mt-1 flex-shrink-0 text-xs">•</span>
                                <span className="text-xs text-foreground leading-relaxed break-words">
                                  {operation}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-foreground">
                            {tCount(lang, "operationsCount", step.operations.length)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        <div className="text-xs text-foreground leading-relaxed">
                          {step.stepInference || t("noInference")}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expand All / Collapse All Controls */}
            <div className="flex justify-center gap-2 mt-4 pt-4">
              <button
                onClick={() => setExpandedSteps(new Set(content.businessDetails?.map((_, i) => i) || []))}
                className="text-xs text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded border border-primary/20 hover:bg-primary/10"
              >
                {t("expandAll")}
              </button>
              <button
                onClick={() => setExpandedSteps(new Set())}
                className="text-xs text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded border border-primary/20 hover:bg-primary/10"
              >
                {t("collapseAll")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
