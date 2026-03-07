export type StepOperation = {
  text: string;
  opTimestamp?: string;
  opTimeSec?: number;
  opStartSec?: number;
  opEndSec?: number;
};
export type ParsedContent = {
  overview?: string;
  duration?: string;
  businessInference?: string;
  keyPoints?: string[];
  nextActions?: string[];
  businessDetails?: Array<{
    stepName: string;
    operations: StepOperation[];
    stepTool?: string;
    stepInference?: string;
    stepTimestamp?: string;
    timeStartSec?: number;
    timeEndSec?: number;
  }>;
};

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function secondsToTimestampLabel(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTimestampRange(start?: number, end?: number): string | undefined {
  if (typeof start === "number" && typeof end === "number" && end > start) {
    return `${secondsToTimestampLabel(start)}-${secondsToTimestampLabel(end)}`;
  }
  if (typeof start === "number") return secondsToTimestampLabel(start);
  return undefined;
}

function parseFlexibleTimestampField(raw: string): { start?: number; end?: number; label: string } | null {
  const stripped = raw.trim().replace(/^\[|\]$/g, "");
  return parseTimestampField(stripped);
}

export function normalizeParsedContent(input: unknown, lang: "ja" | "en" = "en"): ParsedContent {
  const top = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const detailsRaw = Array.isArray(top.businessDetails) ? top.businessDetails : [];
  const businessDetails: NonNullable<ParsedContent["businessDetails"]> = [];

  for (let stepIndex = 0; stepIndex < detailsRaw.length; stepIndex++) {
    const stepRaw = detailsRaw[stepIndex];
    const step = stepRaw && typeof stepRaw === "object" ? (stepRaw as Record<string, unknown>) : {};
    const parsedStepLabel = asTrimmedString(step.stepTimestamp)
      ? parseFlexibleTimestampField(asTrimmedString(step.stepTimestamp)!)
      : null;
    let timeStartSec = asFiniteNumber(step.timeStartSec) ?? parsedStepLabel?.start;
    let timeEndSec = asFiniteNumber(step.timeEndSec) ?? parsedStepLabel?.end;
    if (
      typeof timeStartSec === "number" &&
      typeof timeEndSec === "number" &&
      timeEndSec < timeStartSec
    ) {
      [timeStartSec, timeEndSec] = [timeEndSec, timeStartSec];
    }

    const operationsRaw = Array.isArray(step.operations) ? step.operations : [];
    const operations: StepOperation[] = [];
    for (const opRaw of operationsRaw) {
      const op = opRaw && typeof opRaw === "object" ? (opRaw as Record<string, unknown>) : {};
      const parsedOpLabel = asTrimmedString(op.opTimestamp)
        ? parseFlexibleTimestampField(asTrimmedString(op.opTimestamp)!)
        : null;
      let opStartSec = asFiniteNumber(op.opStartSec) ?? parsedOpLabel?.start;
      let opEndSec = asFiniteNumber(op.opEndSec) ?? parsedOpLabel?.end;
      if (
        typeof opStartSec === "number" &&
        typeof opEndSec === "number" &&
        opEndSec < opStartSec
      ) {
        [opStartSec, opEndSec] = [opEndSec, opStartSec];
      }
      const opTimeSec =
        asFiniteNumber(op.opTimeSec)
        ?? (typeof opStartSec === "number" && typeof opEndSec === "number"
          ? (opStartSec + opEndSec) / 2
          : opStartSec);
      const text = asTrimmedString(op.text) || "";
      const opTimestamp = asTrimmedString(op.opTimestamp) || formatTimestampRange(opStartSec, opEndSec);
      if (!text && !opTimestamp) continue;
      operations.push({
        text,
        opTimestamp,
        opTimeSec,
        opStartSec,
        opEndSec,
      });
    }

    const normalizedStep: NonNullable<ParsedContent["businessDetails"]>[number] = {
      stepName: asTrimmedString(step.stepName) || (lang === "ja" ? `ステップ${stepIndex + 1}` : `Step ${stepIndex + 1}`),
      operations,
      stepTool: asTrimmedString(step.stepTool),
      stepInference: asTrimmedString(step.stepInference),
      stepTimestamp: asTrimmedString(step.stepTimestamp) || formatTimestampRange(timeStartSec, timeEndSec),
      timeStartSec,
      timeEndSec,
    };

    const hasContent =
      normalizedStep.stepName
      || normalizedStep.stepTool
      || normalizedStep.stepInference
      || normalizedStep.stepTimestamp
      || normalizedStep.operations.length > 0;
    if (hasContent) businessDetails.push(normalizedStep);
  }

  const result: ParsedContent = {
    overview: asTrimmedString(top.overview),
    duration: asTrimmedString(top.duration),
    businessInference: asTrimmedString(top.businessInference),
    keyPoints: Array.isArray(top.keyPoints)
      ? top.keyPoints.map((item) => asTrimmedString(item)).filter((item): item is string => !!item)
      : undefined,
    nextActions: Array.isArray(top.nextActions)
      ? top.nextActions.map((item) => asTrimmedString(item)).filter((item): item is string => !!item)
      : undefined,
    businessDetails,
  };

  if ((!result.businessDetails || result.businessDetails.length === 0) && result.overview) {
    result.businessDetails = [
      {
        stepName: lang === "ja" ? "自動生成ステップ" : "Auto Step",
        operations: [{ text: result.overview }],
      },
    ];
  }

  return result;
}

export function shiftParsedContent(content: ParsedContent, offsetSec: number): ParsedContent {
  if (!offsetSec) return normalizeParsedContent(content);
  const shifted = normalizeParsedContent(content);
  return {
    ...shifted,
    businessDetails: (shifted.businessDetails || []).map((step) => {
      const timeStartSec = typeof step.timeStartSec === "number" ? step.timeStartSec + offsetSec : undefined;
      const timeEndSec = typeof step.timeEndSec === "number" ? step.timeEndSec + offsetSec : undefined;
      return {
        ...step,
        timeStartSec,
        timeEndSec,
        stepTimestamp: formatTimestampRange(timeStartSec, timeEndSec) || step.stepTimestamp,
        operations: step.operations.map((op) => {
          const opStartSec = typeof op.opStartSec === "number" ? op.opStartSec + offsetSec : undefined;
          const opEndSec = typeof op.opEndSec === "number" ? op.opEndSec + offsetSec : undefined;
          const opTimeSec = typeof op.opTimeSec === "number" ? op.opTimeSec + offsetSec : undefined;
          return {
            ...op,
            opStartSec,
            opEndSec,
            opTimeSec,
            opTimestamp: formatTimestampRange(opStartSec, opEndSec ?? opTimeSec) || op.opTimestamp,
          };
        }),
      };
    }),
  };
}

export function mergeParsedContents(contents: ParsedContent[], lang: "ja" | "en" = "en"): ParsedContent {
  const normalized = contents
    .map((content) => normalizeParsedContent(content, lang))
    .filter((content) => content.overview || content.businessInference || content.businessDetails?.length);
  if (normalized.length === 0) return { businessDetails: [] };

  const overviews = normalized.map((content) => content.overview).filter((value): value is string => !!value);
  const durations = normalized.map((content) => content.duration).filter((value): value is string => !!value);
  const inferences = normalized
    .map((content) => content.businessInference)
    .filter((value): value is string => !!value);

  return {
    overview: overviews[0],
    duration: durations[durations.length - 1],
    businessInference: Array.from(new Set(inferences)).join("\n"),
    keyPoints: Array.from(new Set(normalized.flatMap((content) => content.keyPoints || []))),
    nextActions: Array.from(new Set(normalized.flatMap((content) => content.nextActions || []))),
    businessDetails: normalized.flatMap((content) => content.businessDetails || []),
  };
}

export function parseTwoColTable(md: string): Array<{ task: string; detail: string }> {
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
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const L = lines[i];
    if (!L.includes("|")) {
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

export function parseTimestampToSeconds(ts: string): number | null {
  const parts = ts.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || /[^0-9]/.test(p))) return null;
  let h = 0, m = 0, s = 0;
  if (parts.length === 2) {
    [m, s] = parts.map((x) => Number(x));
  } else if (parts.length === 3) {
    [h, m, s] = parts.map((x) => Number(x));
  } else {
    return null;
  }
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  return h * 3600 + m * 60 + s;
}

function parseTimestampField(raw: string): { start?: number; end?: number; label: string } | null {
  const cleaned = raw.replace(/\s+/g, "");
  const m = cleaned.split(/[–-]/);
  if (m.length === 1) {
    const t = parseTimestampToSeconds(m[0]);
    if (t == null) return null;
    return { start: t, label: raw.trim() };
  }
  if (m.length === 2) {
    const a = parseTimestampToSeconds(m[0]);
    const b = parseTimestampToSeconds(m[1]);
    if (a == null || b == null) return null;
    const [start, end] = a <= b ? [a, b] : [b, a];
    return { start, end, label: raw.trim() };
  }
  return null;
}

export function parseMarkdownContent(md: string): ParsedContent {
  const lines = md.split(/\r?\n/);
  const result: ParsedContent = { businessDetails: [] };

  let currentSection = "";
  let currentStep: {
    stepName: string;
    operations: StepOperation[];
    stepInference?: string;
    stepTool?: string;
    stepTimestamp?: string;
    timeStartSec?: number;
    timeEndSec?: number;
  } | null = null;

  const sectionMap: Array<{ test: (h: string) => boolean; section: string }> = [
    { test: (h) => h.startsWith("概要") || h.toLowerCase().startsWith("overview"), section: "overview" },
    { test: (h) => h.startsWith("所要時間") || h.toLowerCase().startsWith("duration"), section: "duration" },
    { test: (h) => h.startsWith("解説") || h.toLowerCase().startsWith("business inference"), section: "businessInference" },
    { test: (h) => h.startsWith("重要ポイント") || h.toLowerCase().startsWith("key points"), section: "keyPoints" },
    { test: (h) => h.startsWith("次のアクション") || h.toLowerCase().startsWith("next actions"), section: "nextActions" },
    { test: (h) => h.startsWith("業務詳細") || h.toLowerCase().startsWith("business details"), section: "businessDetails" },
  ];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      const heading = trimmed.slice(3);
      const matched = sectionMap.find((s) => s.test(heading));
      if (matched) {
        currentSection = matched.section;
        continue;
      }
    }

    if (trimmed.startsWith("### ")) {
      if (currentStep) result.businessDetails!.push(currentStep);
      const rawTitle = trimmed
        .replace(/^### /, "")
        .replace(/^ステップ\d+:\s*/, "")
        .replace(/^step\s*\d+:\s*/i, "");
      const stepName = stripDurationFromTitle(rawTitle);
      currentStep = { stepName, operations: [] };
      continue;
    }

    if (!trimmed) continue;

    switch (currentSection) {
      case "overview":
        if (!result.overview && !trimmed.startsWith("#")) result.overview = trimmed.replace(/^\[|\]$/g, "");
        break;
      case "duration":
        if (!result.duration && !trimmed.startsWith("#")) result.duration = trimmed.replace(/^\[|\]$/g, "");
        break;
      case "businessInference":
        if (!result.businessInference && !trimmed.startsWith("#")) result.businessInference = trimmed.replace(/^\[|\]$/g, "");
        break;
      case "keyPoints":
        if (trimmed.startsWith("- ")) {
          result.keyPoints = [...(result.keyPoints || []), trimmed.substring(2).trim()];
        }
        break;
      case "nextActions":
        if (trimmed.startsWith("- ")) {
          result.nextActions = [...(result.nextActions || []), trimmed.substring(2).trim()];
        }
        break;
      case "businessDetails": {
        const isTimestamp = /^\*\*(タイムスタンプ|timestamp):\*\*/i.test(trimmed);
        const isTool = /^\*\*(使用ツール|used tool):\*\*/i.test(trimmed);

        if (isTimestamp && currentStep) {
          const raw = trimmed
            .replace(/^\*\*タイムスタンプ:\*\*\s*/, "")
            .replace(/^\*\*timestamp:\*\*\s*/i, "");
          const parsed = parseTimestampField(raw);
          currentStep.stepTimestamp = raw;
          if (parsed) {
            currentStep.timeStartSec = parsed.start;
            currentStep.timeEndSec = parsed.end;
          }
        } else if (isTool && currentStep) {
          currentStep.stepTool = trimmed
            .replace(/^\*\*使用ツール:\*\*\s*/, "")
            .replace(/^\*\*used tool:\*\*\s*/i, "");
        } else if (trimmed.startsWith("- ") && currentStep) {
          const raw = trimmed.substring(2);
          const m = raw.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)(?:[–-](\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(.*)$/);
          if (m) {
            const start = parseTimestampToSeconds(m[1]);
            const end = m[2] ? parseTimestampToSeconds(m[2]) : null;
            const time = start != null && end != null ? (start + end) / 2 : start != null ? start : null;
            const op: StepOperation = { text: m[3] || "", opTimestamp: m[0].slice(0, m[0].indexOf("]") + 1), opTimeSec: time ?? undefined };
            if (start != null) op.opStartSec = start;
            if (end != null) op.opEndSec = end;
            currentStep.operations.push(op);
          } else {
            currentStep.operations.push({ text: raw });
          }
        } else if (/^\*\*(解説|business inference):\*\*/i.test(trimmed) && currentStep) {
          currentStep.stepInference = trimmed
            .replace(/^\*\*解説:\*\*\s*/, "")
            .replace(/^\*\*business inference:\*\*\s*/i, "");
        }
        break;
      }
    }
  }

  if (currentStep) result.businessDetails!.push(currentStep);

  // --- Fallbacks for new model formats (Gemini 3 Pro preview outputs may omit headings) ---
  // 1) If no overview was extracted, use the first non-heading non-empty line as a lightweight summary.
  if (!result.overview) {
    const firstText = lines
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    if (firstText) result.overview = firstText;
  }

  // 2) If no business details were extracted, try to build a simple step from bullet/numbered lists.
  if (!result.businessDetails || result.businessDetails.length === 0) {
    const bullets = lines
      .map((l) => l.trim())
      .filter((l) => /^[-*+]\s+/.test(l) || /^\d+\.\s+/.test(l))
      .map((l) => l.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, ""))
      .filter((l) => l.length > 0);
    if (bullets.length) {
      result.businessDetails = [
        {
          stepName: "Auto Step",
          operations: bullets.map((text) => ({ text })),
        },
      ];
    }
  }

  return result;
}

function stripDurationFromTitle(title: string): string {
  // Remove bracketed duration hints like 【所要時間xx】 or [Duration xx]
  let s = title
    .replace(/【[^】]*所要時間[^】]*】/g, "")
    .replace(/【\s*Duration[^】]*】/gi, "")
    .replace(/\[[^\]]*Duration[^\]]*\]/gi, "")
    .trim();
  // Collapse extra spaces
  s = s.replace(/\s{2,}/g, " ");
  return s;
}
