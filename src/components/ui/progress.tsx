"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = {
  value: number;
  className?: string;
};

export function Progress({ value, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const done = clamped >= 100;
  return (
    <div
      className={cn("h-3 w-full rounded-full border border-border bg-card overflow-hidden", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div className="relative h-full w-full">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)] bg-foreground",
          )}
          style={{ width: `${clamped}%` }}
        />
        {!done && (
          <div
            className="absolute inset-y-0 left-0 rounded-full progress-stripes"
            style={{ width: `${clamped}%` }}
          />
        )}
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
