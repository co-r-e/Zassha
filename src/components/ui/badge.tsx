import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "outline" }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const styles =
    variant === "outline"
      ? "border border-border text-foreground"
      : "bg-secondary text-secondary-foreground";
  return <span className={cn(base, styles, className)} {...props} />;
}

