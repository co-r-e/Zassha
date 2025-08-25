import { NextRequest } from "next/server";
import { readFile, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get("uploadId");
    const type = searchParams.get("type"); // docx | xlsx
    if (!uploadId || !type) return new Response("bad request", { status: 400 });
    const ext = type === "docx" ? ".docx" : type === "xlsx" ? ".xlsx" : null;
    if (!ext) return new Response("bad request", { status: 400 });
    const p = join(tmpdir(), "zassha", "results", `${uploadId}${ext}`);
    const s = await stat(p).catch(() => null);
    if (!s) return new Response("not found", { status: 404 });
    const buf = await readFile(p);
    const mime = ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return new Response(new Uint8Array(buf).buffer, { headers: { "Content-Type": mime, "Content-Disposition": `attachment; filename=\"result${ext}\"` } });
  } catch (e) {
    return new Response("error", { status: 500 });
  }
}


