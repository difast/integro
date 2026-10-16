"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";

type CompanyVideoProps = {
  title: string;
  webm: string;
  mp4: string;
  poster: string;
  width: number;
  height: number;
  hasAudio: boolean;
};

/**
 * Ролик о компании. Воспроизводится без звука, только когда виден на экране,
 * и не запускается сам, если пользователь отключил анимацию в системе.
 * Субтитры вшиты в видео, поэтому ролик понятен и без звука.
 */
export function CompanyVideo({ title, webm, mp4, poster, width, height, hasAudio }: CompanyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && !userPaused.current) {
          video.play().catch(() => undefined);
        } else if (!entry.isIntersecting) {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => undefined);
    } else {
      userPaused.current = true;
      video.pause();
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
    if (!next) {
      // Включение звука — осознанное действие: начинаем ролик сначала.
      video.currentTime = 0;
      userPaused.current = false;
      video.play().catch(() => undefined);
    }
  };

  const fullscreen = () => {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen().catch(() => undefined);
    else video.webkitEnterFullscreen?.();
  };

  const controlClass =
    "inline-flex min-h-11 items-center gap-2 rounded-[2px] bg-navy-950/80 px-4 text-[0.875rem] font-medium text-white backdrop-blur-sm transition-colors hover:bg-navy-950";

  return (
    <figure className="relative border-t-[3px] border-accent bg-navy-950 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
      <video
        ref={videoRef}
        className="block aspect-video h-auto w-full"
        width={width}
        height={height}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={title}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={togglePlay}
          className={`pointer-events-auto ${controlClass}`}
          aria-label={playing ? "Пауза" : "Воспроизвести ролик"}
        >
          {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
          <span className="hidden sm:inline">{playing ? "Пауза" : "Смотреть"}</span>
        </button>
        <div className="flex gap-2">
          {hasAudio ? (
            <button
              type="button"
              onClick={toggleSound}
              className={`pointer-events-auto ${controlClass}`}
              aria-pressed={!muted}
            >
              {muted ? (
                <VolumeX aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Volume2 aria-hidden="true" className="h-4 w-4" />
              )}
              {muted ? "Со звуком" : "Без звука"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={fullscreen}
            className={`pointer-events-auto ${controlClass}`}
            aria-label="Развернуть на весь экран"
          >
            <Maximize2 aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Развернуть</span>
          </button>
        </div>
      </div>
    </figure>
  );
}
