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

export async function buildDocxSingle(file: ExportFile, images?: ImageMap, labels?: DocxLabels): Promise<Blob> {
  const docx: typeof import("docx") = await import("docx");
  const { Document, Packer, Paragraph, HeadingLevel, ImageRun } = docx;

  const children: any[] = [];
  const f = file;
  // Title (visual heading)
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

  // Markdown-like section per step
  if (f.content.businessDetails && f.content.businessDetails.length) {
    // add some space before details
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: L.businessDetailsHeader.replace(/^#+\s*/, ""), heading: HeadingLevel.HEADING_2 }));
    for (let i = 0; i < f.content.businessDetails.length; i++) {
      const step = f.content.businessDetails[i];
      // ### Step N: [name]
      // Step heading (visual) — strip any markdown hashes if present
      const stepTitle = L.stepHeading(i + 1, step.stepName).replace(/^#+\s*/, "");
      children.push(new Paragraph({ text: stepTitle, heading: HeadingLevel.HEADING_2 }));
      if (step.stepTool) children.push(new Paragraph({ text: `${L.usedTool}: ${step.stepTool}` }));
      if (step.stepInference) children.push(new Paragraph({ text: `${L.stepInference}: ${step.stepInference}` }));
      if (step.stepTimestamp) children.push(new Paragraph({ text: `${L.timestamp}: ${step.stepTimestamp}` }));
      // Operations: image first, then text; 1 blank line between operations
      for (let o = 0; o < step.operations.length; o++) {
        const op = step.operations[o];
        const key = `${i}-${o}`;
        const img = images ? images[key] : undefined;
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
        const line = `${op.opTimestamp ? `${op.opTimestamp} ` : ""}${op.text}`;
        children.push(new Paragraph({ text: line }));
        // one blank line after each operation
        children.push(new Paragraph({ text: "" }));
      }
      // three blank lines between steps
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return blob;

  // helper no longer used (table removed)
}

export async function buildXlsxSingle(file: ExportFile, sheetName: string): Promise<Blob> {
  const ExcelJS: typeof import("exceljs") = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  {
    const ws = wb.addWorksheet(sanitizeSheetName(sheetName));
    const header = ["No.", "Step Name", "Step Inference", "Used Tool", "Operation Timestamp", "Operation"];
    ws.addRow(header);
    // Freeze header and enable autofilter
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
    // Style header row
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
    // Basic width + alignment
    const widths = [6, 24, 32, 20, 20, 60];
    widths.forEach((w, idx) => {
      const col = ws.getColumn(idx + 1);
      col.width = w;
      // alignment: wrap text for text-heavy columns
      if (idx >= 1) col.alignment = { wrapText: true, vertical: "top" } as Partial<ExcelJSType.Alignment>;
    });
    // Center align for No. column
    ws.getColumn(1).alignment = { horizontal: "center", vertical: "middle" } as Partial<ExcelJSType.Alignment>;
    // Zebra striping + light borders for data
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
