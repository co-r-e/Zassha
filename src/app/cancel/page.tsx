"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CancelPage() {
  return (
    <div className="min-h-dvh flex items-start justify-center">
      <div className="w-full max-w-[720px] space-y-4">
        <h1 className="text-lg font-semibold">操作がキャンセルされました</h1>
        <p className="text-sm text-muted-foreground">トップに戻ってやり直してください。</p>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button>トップへ戻る</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}



