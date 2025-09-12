import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import { CHUNK_SIZE_BYTES } from "@/config";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = path.join(os.tmpdir(), "zassha_uploads");

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const fileName = (fd.get("fileName") as string) || "video.mp4";
  const size = Number(fd.get("size") || 0);
  const chunkSize = Number(fd.get("chunkSize") || CHUNK_SIZE_BYTES);
  if (!size || size <= 0) return Response.json({ error: "invalid size" }, { status: 400 });
  await fs.mkdir(BASE, { recursive: true });
  const uploadId = randomUUID();
  const dir = path.join(BASE, uploadId);
  await fs.mkdir(dir, { recursive: true });
  const manifest = { uploadId, fileName, size, chunkSize, nextIndex: 0, createdAt: Date.now() };
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  return Response.json({ ok: true, uploadId, chunkSize });
}
