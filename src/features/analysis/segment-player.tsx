"use client";

import * as React from "react";

export default function SegmentPlayer({
  src,
  start,
  end,
  poster,
  width = 200,
  height = 112,
  label,
}: {
  src: string;
  start: number;
  end: number;
  poster?: string;
  width?: number;
  height?: number;
  label?: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [hover, setHover] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= end - 0.05) {
        v.currentTime = Math.max(0, start);
        if (hover) void v.play().catch(() => {});
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [start, end, hover]);

  const handleEnter = async () => {
    setHover(true);
    const v = videoRef.current;
    if (!v) return;
    try {
      if (!ready) await v.play();
      v.currentTime = Math.max(0, start);
      await v.play();
    } catch {}
  };
  const handleLeave = () => {
    setHover(false);
    const v = videoRef.current;
    if (!v) return;
    v.pause();
  };

  return (
    <div
      className="relative rounded-md border border-border bg-card overflow-hidden"
      style={{ width, height }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="metadata"
        poster={poster}
        width={width}
        height={height}
        onLoadedMetadata={() => setReady(true)}
        className="w-full h-full object-cover"
      />
      {label ? (
        <div className="absolute left-1 top-1 text-[10px] bg-background/80 text-foreground rounded px-1 py-[1px] border border-border">
          {label}
        </div>
      ) : null}
      {!hover && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-white/90">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow">
            <path d="M8 5v14l11-7z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}
