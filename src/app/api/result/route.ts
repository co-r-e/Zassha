import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uploadId: string | null = searchParams.get("uploadId");

    if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

    const base = join(tmpdir(), "zassha", "results");
    const statusPath = join(base, `${uploadId}.status.json`);
    const statusRaw = await readFile(statusPath, "utf8").catch(() => null);
    if (statusRaw) {
      const stat = JSON.parse(statusRaw) as { phase: string; progress: number; message?: string | null };
      const phaseJp: Record<string, string> = {
        starting: "開始準備",
        "uploading-to-gemini": "Geminiにアップロード中",
        "waiting-active": "処理待機中",
        generating: "解説を生成中",
        "building-attachments": "ドキュメント生成中",
        error: "エラー",
        done: "完了",
      };
      if (stat.phase !== "done")
        return NextResponse.json({
          status: "queued",
          phase: stat.phase,
          phaseLabel: phaseJp[stat.phase] ?? "処理中",
          progress: stat.progress,
          message: stat.message ?? null,
        });
    }
    const p = join(base, `${uploadId}.json`);
    const data = await readFile(p, "utf8").catch(() => null);
    if (!data) return NextResponse.json({ status: "queued" });
    const json = JSON.parse(data) as { text: string };
    return NextResponse.json({ status: "done", text: json.text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "internal error" }, { status: 500 });
  }
}

