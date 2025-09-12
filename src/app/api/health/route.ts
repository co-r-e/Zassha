export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { CHUNK_THRESHOLD_BYTES, CHUNK_SIZE_BYTES, SEGMENT_LEN_SEC } from "@/config";
import { spawn } from "node:child_process";

export async function GET() {
  const hasGemini = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
  const hasFfmpeg = await detectFfmpeg();
  return Response.json({ ok: true, hasGemini, hasFfmpeg, config: { chunkThresholdBytes: CHUNK_THRESHOLD_BYTES, chunkSizeBytes: CHUNK_SIZE_BYTES, segmentLenSec: SEGMENT_LEN_SEC } });
}

function detectFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ps = spawn("ffmpeg", ["-version"]);
      ps.on("exit", (code) => resolve(code === 0));
      ps.on("error", () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}
