"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = {
  value: number;
  className?: string;
};

export function Progress({ value, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-3 w-full rounded-full border border-border bg-card overflow-hidden", className)}>
      <div className="relative h-full w-full">
        {/* eased width transition bar */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
          style={{ width: `${clamped}%` }}
        />
        {/* animated stripes overlay */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full progress-stripes",
          )}
          style={{ width: `${clamped}%` }}
        />
        {/* subtle glow */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${clamped}%`,
            boxShadow: "0 0 16px rgba(12,41,232,0.35)",
          }}
        />
      </div>
    </div>
  );
}


