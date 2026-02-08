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
