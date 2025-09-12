import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = path.join(os.tmpdir(), "zassha_uploads");

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const uploadId = (fd.get("uploadId") as string) || "";
  if (!uploadId) return Response.json({ error: "bad request" }, { status: 400 });
  const dir = path.join(BASE, uploadId);
  const manPath = path.join(dir, "manifest.json");
  try {
    const manifest = JSON.parse(await fs.readFile(manPath, "utf8")) as { nextIndex: number; chunkSize: number; size: number; fileName: string };
    const written = (manifest.nextIndex * manifest.chunkSize);
    if (written < manifest.size) return Response.json({ error: "incomplete" }, { status: 409 });
    const partPath = path.join(dir, "file.part");
    const ext = path.extname(manifest.fileName) || ".mp4";
    const finalPath = path.join(dir, "final" + ext);
    await fs.rename(partPath, finalPath).catch(async () => {
      const data = await fs.readFile(partPath);
      await fs.writeFile(finalPath, data);
      await fs.unlink(partPath).catch(() => {});
    });
    return Response.json({ ok: true, uploadId, fileName: manifest.fileName });
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
