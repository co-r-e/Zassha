"use client";

import * as React from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

type VideoLightboxProps = {
  open: boolean;
  src: string | null;
  start: number;
  end: number;
  poster?: string | null;
  onClose: () => void;
  label?: string | null;
};

export default function VideoLightbox({
  open,
  src,
  start,
  end,
  poster,
  onClose,
  label,
}: VideoLightboxProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [muted, setMuted] = React.useState(true);
  const [volume, setVolume] = React.useState(0.6);
  const [progress, setProgress] = React.useState(0); // 0..1 within [start,end]
  const [seeking, setSeeking] = React.useState(false);

  const isPlayingRef = React.useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const seekingRef = React.useRef(seeking);
  seekingRef.current = seeking;
  const volumeRef = React.useRef(volume);
  volumeRef.current = volume;
  const mutedRef = React.useRef(muted);
  mutedRef.current = muted;

  const togglePlay = React.useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      try { await v.play(); setIsPlaying(true); } catch { /* autoplay may be blocked */ }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      if (e.key.toLowerCase() === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, togglePlay, toggleMute]);

  React.useEffect(() => {
    if (!open) return;
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = async () => {
      try {
        v.currentTime = Math.max(0, start);
        v.volume = volumeRef.current;
        v.muted = true; // enforce muted for autoplay
        try {
          await v.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      } catch {}
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      if (v.currentTime >= end - 0.05) {
        v.currentTime = Math.max(0, start);
        if (isPlayingRef.current) void v.play().catch(() => {});
      }
      const dur = Math.max(0.001, end - start);
      const p = (v.currentTime - start) / dur;
      if (!seekingRef.current) setProgress(Math.max(0, Math.min(1, p)));
    };
    v.addEventListener("loadedmetadata", onLoaded, { once: true });
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [open, start, end]);

  const onVolumeChange = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    setVolume(clamped);
    if (clamped === 0) {
      v.muted = true;
      setMuted(true);
    } else if (muted) {
      v.muted = false;
      setMuted(false);
    }
  };

  const durSec = () => Math.max(0.001, end - start);
  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  };
  const seekToRatio = (ratio: number) => {
    const v = videoRef.current;
    if (!v) return;
    const r = Math.max(0, Math.min(1, ratio));
    v.currentTime = start + r * durSec();
    setProgress(r);
  };
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    setSeeking(true);
    const apply = (clientX: number) => {
      const rect = trackRef.current!.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      seekToRatio(ratio);
    };
    apply(e.clientX);
    const onMove = (ev: PointerEvent) => apply(ev.clientX);
    const onUp = (ev: PointerEvent) => {
      apply(ev.clientX);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setSeeking(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  const volRef = React.useRef<HTMLDivElement | null>(null);
  const onVolPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!volRef.current) return;
    const apply = (clientX: number) => {
      const rect = volRef.current!.getBoundingClientRect();
      const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onVolumeChange(r);
    };
    apply(e.clientX);
    const onMove = (ev: PointerEvent) => apply(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  if (!open || !src) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-[90vw] h-[80vh] max-w-[1400px] mx-auto my-[5vh] rounded-md overflow-hidden border border-white/10 bg-black/40" onClick={(e) => e.stopPropagation()}>
        <video
          ref={videoRef}
          src={src}
          muted={muted}
          playsInline
          autoPlay
          poster={poster || undefined}
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />

        {/* Label */}
        {label ? (
          <div className="absolute left-3 top-3 text-[12px] bg-black/60 text-white rounded px-2 py-1 border border-white/20">
            {label}
          </div>
        ) : null}

        {/* Bottom bar: controls + seek */}
        <div className="absolute left-3 right-3 bottom-3 flex items-center gap-4 bg-black/40 backdrop-blur-sm rounded-md px-3 py-2 border border-white/10">
          <div className="flex items-center gap-3">
            <button type="button" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="w-8 h-8 grid place-items-center rounded-full bg-white/95 text-black hover:bg-white">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="w-8 h-8 grid place-items-center rounded-full bg-white/95 text-black hover:bg-white">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div ref={volRef} onPointerDown={onVolPointerDown} className="relative w-28 h-1.5 bg-white/30 rounded-full cursor-pointer select-none">
              <div className="absolute left-0 top-0 h-full bg-white rounded-full" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow -ml-1" style={{ left: `${(muted ? 0 : volume) * 100}%` }} />
            </div>
          </div>
          <div className="flex-1 flex items-center gap-3">
            <span className="text-[11px] text-white/80 tabular-nums">{formatTime(progress * durSec())}</span>
            <div ref={trackRef} onPointerDown={onTrackPointerDown} className="relative w-full h-1.5 bg-white/25 rounded-full cursor-pointer select-none">
              <div className="absolute left-0 top-0 h-full bg-white rounded-full" style={{ width: `${progress * 100}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow -ml-1" style={{ left: `${progress * 100}%` }} />
            </div>
            <span className="text-[11px] text-white/80 tabular-nums">{formatTime(durSec())}</span>
          </div>
        </div>

        {/* Close */}
        <button type="button" aria-label="Close" className="absolute right-3 top-3 px-2 py-1.5 text-[12px] rounded-md bg-black/60 text-white hover:bg-black/80" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
