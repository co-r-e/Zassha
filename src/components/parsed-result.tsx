"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Clock, Eye, List } from "lucide-react";

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

function parseMarkdownContent(md: string): ParsedContent {
  const lines = md.split(/\r?\n/);
  const result: ParsedContent = {
    businessDetails: []
  };

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
      // Save previous step if exists
      if (currentStep) {
        result.businessDetails!.push(currentStep);
      }
      // Start new step
      const stepName = trimmed.replace(/^### /, "").replace(/^ステップ\d+:\s*/, "");
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

  // If parsing failed, show raw content
  if (!content.overview && !content.businessDetails?.length) {
    return (
      <div className="text-xs text-muted-foreground">
        解析テキストの形式を認識できませんでした。元のテキストを表示します。
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
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">概要</div>
              <div className="text-xs text-muted-foreground leading-relaxed mb-2">
                {content.overview || "概要情報なし"}
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
                <span className="text-[11px] font-semibold text-muted-foreground">業務推察</span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {content.businessInference || "推察情報なし"}
              </div>
            </div>

            {/* Token Usage */}
            {tokens && (
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground mb-2">トークン使用量</div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">入力:</span>
                    <span className="text-foreground font-medium">{tokens.inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">出力:</span>
                    <span className="text-foreground font-medium">{tokens.outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span className="text-muted-foreground">合計:</span>
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
              <span className="text-sm font-medium text-foreground">業務詳細</span>
            </div>

            {/* Table Layout */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-12">No.</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-60">ステップ名</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-48">使用ツール</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-80">操作詳細</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-96">業務推察</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground bg-muted/30 w-20">展開</th>
                  </tr>
                </thead>
                <tbody>
                  {content.businessDetails.map((step, index) => (
                    <tr
                      key={index}
                      className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => toggleStep(index)}
                      title={isMounted && expandedSteps.has(index) ? "クリックして折りたたむ" : "クリックして展開する"}
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
                        <div className="text-xs text-muted-foreground leading-relaxed">
                          {step.stepTool || "不明"}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        {isMounted && expandedSteps.has(index) ? (
                          <div className="space-y-2">
                            {step.operations.map((operation, opIndex) => (
                              <div key={opIndex} className="flex items-start gap-2">
                                <span className="text-primary mt-1 flex-shrink-0 text-xs">•</span>
                                <span className="text-xs text-muted-foreground leading-relaxed break-words">
                                  {operation}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {step.operations.length}個の操作 (クリックして展開)
                          </div>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        <div className="text-xs text-muted-foreground leading-relaxed">
                          {step.stepInference || "推察情報なし"}
                        </div>
                      </td>
                      <td className="p-3 align-top text-center">
                        <div className="flex items-center justify-center">
                          {isMounted && expandedSteps.has(index) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expand All / Collapse All Controls */}
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-border">
              <button
                onClick={() => setExpandedSteps(new Set(content.businessDetails?.map((_, i) => i) || []))}
                className="text-xs text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded border border-primary/20 hover:bg-primary/10"
              >
                すべて展開
              </button>
              <button
                onClick={() => setExpandedSteps(new Set())}
                className="text-xs text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded border border-primary/20 hover:bg-primary/10"
              >
                すべて折りたたみ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

