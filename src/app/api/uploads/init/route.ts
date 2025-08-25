import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, readdir, stat, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // GC old files
    const baseRoot = join(tmpdir(), "zassha");
    const ttlMs = Number(process.env.MAX_TMP_TTL_MS ?? "86400000");
    const now = Date.now();
    for (const sub of ["uploads", "results", "work"]) {
      const dir = join(baseRoot, sub);
      try {
        const entries = await readdir(dir);
        for (const name of entries) {
          const p = join(dir, name);
          try {
            const st = await stat(p);
            if (now - st.mtimeMs > ttlMs) {
              await rm(p, { recursive: true, force: true });
            }
          } catch {}
        }
      } catch {}
    }

    const id = randomUUID();
    const base = join(tmpdir(), "zassha", "uploads", id);
    await mkdir(base, { recursive: true });
    return NextResponse.json({ uploadId: id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "internal error" }, { status: 500 });
  }
}

