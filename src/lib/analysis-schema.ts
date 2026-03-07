import type { ParsedContent } from "@/lib/parse-content";

export const ANALYSIS_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "businessDetails"],
  propertyOrdering: ["overview", "duration", "businessInference", "keyPoints", "nextActions", "businessDetails"],
  properties: {
    overview: { type: "string" },
    duration: { type: "string" },
    businessInference: { type: "string" },
    keyPoints: {
      type: "array",
      items: { type: "string" },
    },
    nextActions: {
      type: "array",
      items: { type: "string" },
    },
    businessDetails: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stepName", "operations"],
        propertyOrdering: ["stepName", "stepTool", "stepInference", "stepTimestamp", "timeStartSec", "timeEndSec", "operations"],
        properties: {
          stepName: { type: "string" },
          stepTool: { type: "string" },
          stepInference: { type: "string" },
          stepTimestamp: { type: "string" },
          timeStartSec: { type: "number" },
          timeEndSec: { type: "number" },
          operations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text"],
              propertyOrdering: ["text", "opTimestamp", "opTimeSec", "opStartSec", "opEndSec"],
              properties: {
                text: { type: "string" },
                opTimestamp: { type: "string" },
                opTimeSec: { type: "number" },
                opStartSec: { type: "number" },
                opEndSec: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function summarizeStructuredResultForBridge(result: ParsedContent, lang: "ja" | "en"): string {
  const text = [
    result.overview,
    ...(result.keyPoints || []),
    ...((result.businessDetails || []).slice(-3).flatMap((step) => [
      step.stepName,
      step.stepInference,
      ...(step.operations || []).slice(0, 3).map((op) => op.text),
    ])),
  ]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-500);

  return lang === "ja" ? `前要約: ${text}` : `Prev: ${text}`;
}
