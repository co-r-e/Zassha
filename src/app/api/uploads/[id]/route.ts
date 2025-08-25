import { NextResponse } from "next/server";
import { mkdir, stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { lookup as mimeLookup } from "mime-types";
import Busboy from "busboy";
import { createWriteStream } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const match = url.pathname.match(/\/api\/uploads\/([^/]+)/);
    const id = match?.[1] || "";
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    // Optional early rejection using Content-Length header
    const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? "0");
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (maxBytes > 0 && contentLength > 0 && contentLength > maxBytes) {
      return NextResponse.json({ error: "file too large", maxBytes }, { status: 413 });
    }

    // Stream parse using Busboy
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "content-type must be multipart/form-data" }, { status: 400 });
    }
    const base = join(tmpdir(), "zassha", "uploads", id);
    await mkdir(base, { recursive: true });

    const bb = Busboy({ headers: { "content-type": contentType } });
    const incoming = Readable.fromWeb(req.body as any);

    let savedPath = "";
    let savedName = "";
    let bytes = 0;
    let rejected = false;
    let fileDone: Promise<void> | null = null;
    let fileDoneResolve: (() => void) | null = null;

    const doneP = new Promise<void>((resolve, reject) => {
      bb.on("file", (_fieldname, file, info) => {
        const { filename, mimeType } = info;
        const mime = mimeType || (mimeLookup(filename || "") || "");
        if (!String(mime).startsWith("video/")) {
          rejected = true;
          file.resume();
          return reject(new Error("unsupported media type"));
        }
        savedName = filename || "upload.bin";
        const dest = join(base, savedName);
        const ws = createWriteStream(dest);
        fileDone = new Promise<void>((res) => { fileDoneResolve = res; });
        file.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (maxBytes > 0 && bytes > maxBytes && !rejected) {
            rejected = true;
            file.unpipe(ws);
            ws.destroy();
            file.resume();
            unlink(dest).catch(() => {});
            reject(Object.assign(new Error("file too large"), { status: 413 }));
          }
        });
        file.on("error", (err: any) => {
          ws.destroy();
          reject(err);
        });
        ws.on("error", (err) => reject(err));
        ws.on("close", () => {
          if (!rejected) {
            savedPath = dest;
          }
          if (fileDoneResolve) fileDoneResolve();
        });
        file.pipe(ws);
      });
      bb.on("error", (err) => reject(err));
      bb.on("finish", async () => {
        if (fileDone) {
          try { await fileDone; } catch {}
        }
        resolve();
      });
    });

    incoming.pipe(bb);
    await doneP;

    if (rejected) {
      return NextResponse.json({ error: "file too large", maxBytes }, { status: 413 });
    }
    if (!savedPath) return NextResponse.json({ error: "file required" }, { status: 400 });
    const st = await stat(savedPath);
    return NextResponse.json({ path: savedPath, bytes: st.size, name: savedName, maxBytes: maxBytes || undefined });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "internal error" }, { status: 500 });
  }
}
