"use client";

import * as React from "react";
import NextImage from "next/image";

type LightboxProps = {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export default function Lightbox({ open, src, alt = "", onClose }: LightboxProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div className="relative w-[90vw] h-[82vh] max-w-[1280px] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Close"
          className="absolute right-2 top-2 z-10 rounded-md bg-black/60 text-white text-xs px-2 py-1 hover:bg-black/80"
          onClick={onClose}
        >
          × Close
        </button>
        <div className="relative w-full h-full rounded-md overflow-hidden border border-white/20 bg-black/40">
          <NextImage src={src} alt={alt} fill className="object-contain" sizes="(max-width: 1280px) 90vw, 1280px" />
        </div>
      </div>
    </div>
  );
}
