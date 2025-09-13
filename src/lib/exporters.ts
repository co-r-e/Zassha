import type { ParsedContent } from "@/lib/parse-content";
import type * as ExcelJSType from "exceljs";

export type ExportFile = { fileName: string; content: ParsedContent };
export type ImageAttachment = { data: ArrayBuffer; width: number; height: number; caption?: string };
export type ImageMap = Record<string, ImageAttachment | undefined>;

export type DocxLabels = {
  stepHeading: (n: number, name: string) => string;
  usedTool: string;
  stepInference: string;
  timestamp: string;
  duration: string;
  businessInference: string;
  overviewHeader: string;
  businessDetailsHeader: string;
};

export function makeDocLabels(lang: "en" | "ja"): DocxLabels {
  if (lang === "ja") {
    return {
      stepHeading: (n, name) => `### ステップ${n}: ${name}`,
      usedTool: "使用ツール",
      stepInference: "解説",
      timestamp: "タイムスタンプ",
      duration: "所要時間",
      businessInference: "解説",
      overviewHeader: "## 概要",
      businessDetailsHeader: "## 業務詳細",
    };
  }
  return {
    stepHeading: (n, name) => `### Step ${n}: ${name}`,
    usedTool: "Used Tool",
    stepInference: "Step Inference",
    timestamp: "Timestamp",
    duration: "Duration",
    businessInference: "Business Inference",
    overviewHeader: "## Overview",
    businessDetailsHeader: "## Business Details",
  };
}

export async function buildDocxSingle(file: ExportFile, images?: ImageMap, labels?: DocxLabels): Promise<Blob> {
  const docx: typeof import("docx") = await import("docx");
  const { Document, Packer, Paragraph, HeadingLevel, ImageRun, TextRun } = docx;

  const children: import("docx").FileChild[] = [];
  const f = file;
  children.push(new Paragraph({ text: f.fileName, heading: HeadingLevel.TITLE }));
  const L: DocxLabels = labels ?? {
    stepHeading: (n, name) => `### Step ${n}: ${name}`,
    usedTool: "Used Tool",
    stepInference: "Step Inference",
    timestamp: "Timestamp",
    duration: "Duration",
    businessInference: "Business Inference",
    overviewHeader: "## Overview",
    businessDetailsHeader: "## Business Details",
  };
  if (f.content.overview) {
    children.push(new Paragraph({ text: L.overviewHeader.replace(/^#+\s*/, ""), heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: f.content.overview }));
  }
  if (f.content.duration) {
    children.push(new Paragraph({ text: L.duration, heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: f.content.duration }));
  }
  if (f.content.businessInference) {
    children.push(new Paragraph({ text: L.businessInference, heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: f.content.businessInference }));
  }

  if (f.content.businessDetails && f.content.businessDetails.length) {
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: L.businessDetailsHeader.replace(/^#+\s*/, ""), heading: HeadingLevel.HEADING_2 }));
    for (let i = 0; i < f.content.businessDetails.length; i++) {
      const step = f.content.businessDetails[i];
      const stepTitle = L.stepHeading(i + 1, step.stepName).replace(/^#+\s*/, "");
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: stepTitle, bold: true, size: 32 })], // ~16pt for larger visibility
        })
      );
      if (step.stepTool)
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${L.usedTool}: `, bold: true }), new TextRun({ text: step.stepTool })],
          })
        );
      if (step.stepInference)
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${L.stepInference}: `, bold: true }), new TextRun({ text: step.stepInference })],
          })
        );
      if (step.stepTimestamp)
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${L.timestamp}: `, bold: true }), new TextRun({ text: step.stepTimestamp })],
          })
        );
      for (let o = 0; o < step.operations.length; o++) {
        const op = step.operations[o];
        const key = `${i}-${o}`;
        const img = images ? images[key] : undefined;
        if (o === 0) {
          children.push(new Paragraph({ text: "" }));
          children.push(new Paragraph({ text: "" }));
        }
        const line = `${op.opTimestamp ? `${op.opTimestamp} ` : ""}${op.text}`;
        children.push(new Paragraph({ text: line, bullet: { level: 0 } }));
        if (img) {
          children.push(new Paragraph({
            children: [
              new ImageRun({
                type: "jpg",
                data: img.data instanceof Uint8Array ? img.data : new Uint8Array(img.data),
                transformation: {
                  width: Math.round(Math.min(960, img.width) / 2),
                  height: Math.round((Math.min(960, img.width) / 2) * (img.height / img.width)),
                },
              }),
            ],
          }));
        }
        children.push(new Paragraph({ text: "" }));
      }
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "" }));
    }
  }

  const defaultRunFont = { font: { ascii: "Yu Gothic UI", hAnsi: "Yu Gothic UI", eastAsia: "Yu Gothic UI" } } as const;
  const doc = new Document({
    styles: {
      default: {
        document: { run: defaultRunFont },
        title: { run: defaultRunFont },
        heading1: { run: defaultRunFont },
        heading2: { run: defaultRunFont },
        heading3: { run: defaultRunFont },
        heading4: { run: defaultRunFont },
        heading5: { run: defaultRunFont },
        heading6: { run: defaultRunFont },
      },
    },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  return blob;
}

export async function buildXlsxSingle(file: ExportFile, sheetName: string): Promise<Blob> {
  const ExcelJS: typeof import("exceljs") = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  {
    const ws = wb.addWorksheet(sanitizeSheetName(sheetName));
    const header = ["No.", "Step Name", "Step Inference", "Used Tool", "Operation Timestamp", "Operation"];
    ws.addRow(header);
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: 1,
        column: header.length,
      },
    };
    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    for (let c = 1; c <= header.length; c++) {
      const cell = headerRow.getCell(c);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } } as Partial<ExcelJSType.Font>;
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true } as Partial<ExcelJSType.Alignment>;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } } as ExcelJSType.Fill; // gray-800
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      } as Partial<ExcelJSType.Borders>;
    }
    (file.content.businessDetails || []).forEach((step, i) => {
      const ops = step.operations.length ? step.operations : [{ text: "" }];
      ops.forEach((op) => {
        ws.addRow([
          i + 1,
          step.stepName || "",
          step.stepInference || "",
          step.stepTool || "",
          op.opTimestamp || "",
          op.text || "",
        ]);
      });
    });
    
    const widths = [6, 24, 32, 20, 20, 60];
    widths.forEach((w, idx) => {
      const col = ws.getColumn(idx + 1);
      col.width = w;
      if (idx >= 1) col.alignment = { wrapText: true, vertical: "top" } as Partial<ExcelJSType.Alignment>;
    });
    ws.getColumn(1).alignment = { horizontal: "center", vertical: "middle" } as Partial<ExcelJSType.Alignment>;
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const isEven = r % 2 === 0;
      for (let c = 1; c <= header.length; c++) {
        const cell = row.getCell(c);
        if (isEven) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } } as ExcelJSType.Fill; // gray-100
        }
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        } as Partial<ExcelJSType.Borders>;
      }
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  function sanitizeSheetName(n: string) {
    const s = n.replace(/[:\\/?*\[\]]/g, " ").slice(0, 31);
    return s || "Sheet";
  }
}

export async function buildPptxSingle(
  file: ExportFile,
  images?: ImageMap,
  labels?: DocxLabels
): Promise<Blob> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const L: DocxLabels = labels ?? {
    stepHeading: (n, name) => `### Step ${n}: ${name}`,
    usedTool: "Used Tool",
    stepInference: "Step Inference",
    timestamp: "Timestamp",
    duration: "Duration",
    businessInference: "Business Inference",
    overviewHeader: "## Overview",
    businessDetailsHeader: "## Business Details",
  };

  const font = "Yu Gothic UI";
  const W = 10; // inches for 16:9
  const H = 5.625;
  const M = 0.5; // margin

  {
    const slide = pptx.addSlide();
    slide.addText(file.fileName, {
      x: M,
      y: 1.6,
      w: W - M * 2,
      h: 1.2,
      fontFace: font,
      fontSize: 32,
      bold: true,
      color: "202020",
      align: "center",
    });
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    slide.addText(dateStr, {
      x: M,
      y: 2.9,
      w: W - M * 2,
      h: 0.6,
      fontFace: font,
      fontSize: 16,
      color: "606060",
      align: "center",
    });
  }

  if (file.content.overview || file.content.duration || file.content.businessInference) {
    const slide = pptx.addSlide();
    slide.addText(L.overviewHeader.replace(/^#+\s*/, ""), {
      x: M,
      y: M,
      w: W - M * 2,
      h: 0.6,
      fontFace: font,
      fontSize: 24,
      bold: true,
      align: "center",
    });
    const bullets: string[] = [];
    if (file.content.overview) bullets.push(file.content.overview);
    if (file.content.duration) bullets.push(`${L.duration}: ${file.content.duration}`);
    if (file.content.businessInference) bullets.push(`${L.businessInference}: ${file.content.businessInference}`);
    if (bullets.length) {
      slide.addText(
        bullets.map((t) => ({ text: t, options: { bullet: true, fontFace: font, fontSize: 16 } })),
        { x: M, y: M + 0.8, w: W - M * 2, h: H - (M + 0.8) - M }
      );
    }
  }

  const steps = file.content.businessDetails || [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const ops = step.operations.length ? step.operations : [{ text: "" }];
    for (let o = 0; o < ops.length; o++) {
      const op = ops[o];
      const slide = pptx.addSlide();
      const title = L.stepHeading(i + 1, step.stepName).replace(/^#+\s*/, "");
      slide.addText(title, { x: M, y: M, w: W - M * 2, h: 0.6, fontFace: font, fontSize: 22, bold: true, align: "center" });

      const notesParts: string[] = [];
      if (step.stepInference) notesParts.push(`${L.stepInference}: ${step.stepInference}`);
      if (step.stepTool) notesParts.push(`${L.usedTool}: ${step.stepTool}`);
      if (op.opTimestamp) notesParts.push(`${L.timestamp}: ${op.opTimestamp}`);
      if (notesParts.length) slide.addNotes(notesParts.join("\n"));

      const topY = M + 0.8;
      const bottomCaptionH = 0.9;
      const innerMargin = 0.75; // extra margin to reduce image size
      const imgY = topY;
      const imgH = H - topY - (bottomCaptionH + M);
      const imgW = W - (M + innerMargin) * 2;
      const imgX = (W - imgW) / 2;
      const key = `${i}-${o}`;
      const img = images ? images[key] : undefined;
      if (img) {
        try {
          const imgRatio = img.width > 0 && img.height > 0 ? img.width / img.height : 16 / 9;
          const boxRatio = imgW / imgH;
          let dispW: number, dispH: number;
          if (imgRatio >= boxRatio) {
            dispW = imgW;
            dispH = dispW / imgRatio;
          } else {
            dispH = imgH;
            dispW = dispH * imgRatio;
          }
          const dx = imgX + (imgW - dispW) / 2;
          const dy = imgY + (imgH - dispH) / 2;
          slide.addImage({ data: arrayBufferToDataUrlJPEG(img.data), x: dx, y: dy, w: dispW, h: dispH });
        } catch {
          slide.addText("(screenshot unavailable)", { x: imgX, y: imgY + imgH / 2 - 0.2, w: imgW, h: 0.4, fontFace: font, fontSize: 14, color: "808080", align: "center" });
        }
      } else {
        slide.addText("(no screenshot)", { x: imgX, y: imgY + imgH / 2 - 0.2, w: imgW, h: 0.4, fontFace: font, fontSize: 14, color: "808080", align: "center" });
      }

      const caption = `${op.opTimestamp ? `${op.opTimestamp} ` : ""}${op.text || ""}`.trim();
      if (caption) {
        slide.addText(caption, {
          x: M,
          y: H - M - 0.65,
          w: W - M * 2,
          h: 0.6,
          fontFace: font,
          fontSize: 14,
          align: "center",
        });
      }
    }
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return blob;
}

function arrayBufferToDataUrlJPEG(ab: ArrayBuffer): string {
  if (typeof window !== "undefined") {
    const bytes = new Uint8Array(ab);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[]);
    }
    const base64 = btoa(binary);
    return `data:image/jpeg;base64,${base64}`;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base64 = (Buffer as any).from(ab).toString("base64");
    return `data:image/jpeg;base64,${base64}`;
  }
}

// --- YAML ---
export async function buildYamlSingle(file: ExportFile): Promise<Blob> {
  // Remove undefined fields recursively for cleaner YAML
  const clean = (v: unknown): unknown => {
    if (v == null) return v;
    if (Array.isArray(v)) return v.map((x) => clean(x));
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (val === undefined) continue;
        out[k] = clean(val);
      }
      return out;
    }
    return v;
  };

  const payload = clean({
    fileName: file.fileName,
    overview: file.content.overview || undefined,
    duration: file.content.duration || undefined,
    businessInference: file.content.businessInference || undefined,
    businessDetails: (file.content.businessDetails || []).map((s) => ({
      stepName: s.stepName,
      stepTool: s.stepTool || undefined,
      stepInference: s.stepInference || undefined,
      stepTimestamp: s.stepTimestamp || undefined,
      timeStartSec: s.timeStartSec,
      timeEndSec: s.timeEndSec,
      operations: (s.operations || []).map((op) => ({
        text: op.text,
        opTimestamp: op.opTimestamp || undefined,
        opTimeSec: op.opTimeSec,
        opStartSec: op.opStartSec,
        opEndSec: op.opEndSec,
      })),
    })),
  });

  const yaml = yamlStringify(payload, 0);
  return new Blob([yaml], { type: "text/yaml;charset=utf-8" });
}

function yamlStringify(value: unknown, indent: number): string {
  const pad = (n: number) => " ".repeat(n);

  const strScalar = (s: string): string => {
    if (s.includes("\n")) {
      const lines = s.split(/\n/);
      return `|\n${lines.map((l) => pad(indent + 2) + l).join("\n")}`;
    }
    // Quote if contains special chars or leading/trailing spaces
    if (/^\s|\s$|[:\-?\[\]{},#&*!|>'\"%@`]/.test(s)) {
      return JSON.stringify(s);
    }
    return s;
  };

  const scalar = (v: unknown): string => {
    if (v === null) return "null";
    switch (typeof v) {
      case "string":
        return strScalar(v);
      case "number":
        return Number.isFinite(v) ? String(v) : "null";
      case "boolean":
        return v ? "true" : "false";
      default:
        return "";
    }
  };

  if (value == null || typeof value !== "object") return scalar(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => `${pad(indent)}- ${yamlStringify(item, indent + 2).replace(/^\s+/, "")}`)
      .join("\n");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([k, v]) => {
      const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k);
      if (v == null || typeof v !== "object") {
        return `${pad(indent)}${key}: ${scalar(v)}`;
      }
      const child = yamlStringify(v, indent + 2);
      const isMultiline = /\n/.test(child);
      return `${pad(indent)}${key}:${isMultiline ? "\n" + child : " " + child}`;
    })
    .join("\n");
}
