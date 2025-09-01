import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink, readdir, writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { GoogleGenAI } from "@google/genai";
// import { lookup as mimeLookup } from "mime-types";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildDocx(markdown: string, name: string, lang: "en" | "ja") {
  const lines = markdown.split(/\r?\n/);
  const rows: [string, string][] = [];
  const headerIdx = lines.findIndex((l) =>
    l.includes("|") && (
      (l.includes("業務工程") && l.includes("業務詳細")) ||
      (l.toLowerCase().includes("business task") && l.toLowerCase().includes("business details"))
    )
  );
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const L = lines[i];
      if (!L.includes("|")) continue;
      const cells = L.split("|").map((s) => s.trim());
      if (cells.length < 4) continue;
      rows.push([cells[1] || "", cells[2] || ""]);
    }
  }
  const table = new Table({
    width: { type: WidthType.PERCENTAGE, size: 100 },
    rows: [
      new TableRow({ children: [new TableCell({ children: [new Paragraph(lang === "ja" ? "業務工程" : "Business Task")] }), new TableCell({ children: [new Paragraph(lang === "ja" ? "業務詳細" : "Business Details")] })] }),
      ...rows.map((r) => new TableRow({ children: [new TableCell({ children: [new Paragraph(r[0])] }), new TableCell({ children: [new Paragraph(r[1])] })] })),
    ],
  });
  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children: [new Paragraph({ text: name, spacing: { after: 200 } }), table] }] }));
}

function buildXlsx(markdown: string, lang: "en" | "ja") {
  const lines = markdown.split(/\r?\n/);
  const rows: [string, string][] = [];
  const headerIdx = lines.findIndex((l) =>
    l.includes("|") && (
      (l.includes("業務工程") && l.includes("業務詳細")) ||
      (l.toLowerCase().includes("business task") && l.toLowerCase().includes("business details"))
    )
  );
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const L = lines[i];
      if (!L.includes("|")) continue;
      const cells = L.split("|").map((s) => s.trim());
      if (cells.length < 4) continue;
      rows.push([cells[1] || "", cells[2] || ""]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet([[lang === "ja" ? "業務工程" : "Business Task", lang === "ja" ? "業務詳細" : "Business Details"], ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Result");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function POST(req: NextRequest) {
  try {
    const { uploadId, filename, lang: langInput } = (await req.json()) as { uploadId: string; filename: string; lang?: "en" | "ja" };
    const lang: "en" | "ja" = langInput ?? (req.headers.get("accept-language")?.toLowerCase().startsWith("ja") ? "ja" : "en");
    if (!uploadId || !filename) return NextResponse.json({ error: "invalid params" }, { status: 400 });

    const dir = join(tmpdir(), "zassha", "uploads", uploadId);
    const files = await readdir(dir).catch(() => []);
    if (files.length === 0) return NextResponse.json({ error: "file missing" }, { status: 400 });
    const path = join(dir, files[0]);
    const buf = await readFile(path);

    // helper: write progress status
    const resultsDir = join(tmpdir(), "zassha", "results");
    await mkdir(resultsDir, { recursive: true });
    async function writeStatus(phase: string, progress: number, message?: string) {
      const status = { phase, progress, message: message ?? null, updatedAt: Date.now() };
      await writeFile(join(resultsDir, `${uploadId}.status.json`), JSON.stringify(status)).catch(() => {});
    }
    await writeStatus("starting", 5);

    // Upload to Gemini Files API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
    const ai = new GoogleGenAI({ apiKey });
    await writeStatus("uploading-to-gemini", 15);
    const ab = new ArrayBuffer(buf.byteLength);
    const view = new Uint8Array(ab);
    view.set(buf);
    const uploaded = await ai.files.upload({ file: new File([ab], files[0]) });
    const name = uploaded.name!;
    let latest = uploaded;
    const start = Date.now();
    await writeStatus("waiting-active", 30);
    while (latest.state !== "ACTIVE") {
      if (latest.state === "FAILED") throw new Error(latest.error?.message || "File processing failed");
      if (Date.now() - start > Number(process.env.GEMINI_FILE_WAIT_MS ?? "240000")) throw new Error("Timed out waiting for ACTIVE");
      await new Promise((r) => setTimeout(r, 1200));
      latest = await ai.files.get({ name });
    }

    const prompt = lang === "ja"
      ? "あなたは動画から手順書を作るアシスタントです。出力はマークダウンの表のみで返してください。コードブロック、前置き、後書き、補足文は一切出力しないでください。表の列は左から必ず『業務工程 | 業務詳細』の順にしてください。他の列は作らないでください。業務詳細は一挙手一投足の最小粒度で記述し、1操作=1行としてください。"
      : "You are an assistant that creates step-by-step manuals from videos. LANGUAGE POLICY: Output only in English. If on-screen text or speech is in Japanese or any non-English language, translate the content into natural English. Return only a Markdown table with exactly two columns in order: 'Business Task | Business Details'. Do not output code blocks, headers, or commentary. Describe actions at the smallest granularity, 1 action per row.";

    await writeStatus("generating", 60);
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }, { fileData: { mimeType: latest.mimeType!, fileUri: latest.uri! } }] }],
      config: { temperature: 0.4, maxOutputTokens: 8000 },
    });
    const text = resp.text ?? "";

    // Build attachments
    await writeStatus("building-attachments", 85);
    const docx = await buildDocx(text, filename, lang);
    const xlsx = buildXlsx(text, lang);

    // Email feature removed

    // Persist result (DB-less): write to tmp results
    await mkdir(resultsDir, { recursive: true });
    await writeFile(join(resultsDir, `${uploadId}.json`), JSON.stringify({ text }));
    await writeFile(join(resultsDir, `${uploadId}.docx`), Buffer.from(docx));
    await writeFile(join(resultsDir, `${uploadId}.xlsx`), Buffer.from(xlsx));

    // Cleanup temp file
    await unlink(path).catch(() => {});
    await writeStatus("done", 100);
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    try {
      const bodyUnknown = (await req.json().catch(() => ({}))) as unknown;
      const body = (bodyUnknown && typeof bodyUnknown === "object" ? (bodyUnknown as { uploadId?: string }) : {});
      const uploadId = (body?.uploadId as string | undefined) ?? "";
      if (uploadId) {
        const resultsDir = join(tmpdir(), "zassha", "results");
        await mkdir(resultsDir, { recursive: true });
        await writeFile(join(resultsDir, `${uploadId}.status.json`), JSON.stringify({ phase: "error", progress: 100, message: e instanceof Error ? e.message : "error" })).catch(() => {});
      }
    } catch {}
    return NextResponse.json({ error: e instanceof Error ? e.message : "internal error" }, { status: 500 });
  }
}
