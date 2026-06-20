import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SectionAudioHandle = {
  start: () => void;
  stop: () => void;
};

type Props = {
  src: string;
  label: string;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const SectionAudioPlayer = forwardRef<SectionAudioHandle, Props>(function SectionAudioPlayer(
  { src, label },
  ref,
) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingPlay = useRef(false);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playAudio = async (fromStart: boolean) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    setEnded(false);
    if (fromStart) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : duration;
    const next = max > 0 ? Math.min(Math.max(0, time), max) : Math.max(0, time);
    audio.currentTime = next;
    setCurrentTime(next);
    if (ended && next < max) setEnded(false);
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (ended) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setEnded(false);
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setEnded(false);
    setSeeking(false);
    setCurrentTime(0);
    setVisible(false);
    pendingPlay.current = false;
  };

  useImperativeHandle(ref, () => ({
    start: () => {
      if (!src) return;
      pendingPlay.current = true;
      setVisible(true);
    },
    stop,
  }));

  useEffect(() => {
    if (!visible || !pendingPlay.current || !src) return;
    pendingPlay.current = false;
    void playAudio(true);
  }, [visible, src]);

  useEffect(() => {
    stop();
    setDuration(0);
  }, [src]);

  const cancel = () => stop();

  const replay = () => {
    void playAudio(true);
  };

  const sliderValue = seeking ? currentTime : ended && duration > 0 ? duration : currentTime;
  const progressPct = duration > 0 ? Math.min(100, (sliderValue / duration) * 100) : 0;

  if (!src) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          if (seeking) return;
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          if (audioRef.current) setCurrentTime(audioRef.current.duration || 0);
        }}
      />
      {visible ? (
        <div className="rounded-xl border border-primary/20 bg-card/90 p-3 shadow-sm backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-8 shrink-0 rounded-full"
              onClick={() => void togglePlayPause()}
              aria-label={playing ? t("pauseAudio") : t("resumeAudio")}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-0.5" />}
            </Button>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{label}</p>
            <div className="flex shrink-0 items-center gap-1">
              {ended && (
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={replay}>
                  <RotateCcw className="size-3.5" />
                  {t("replayAudio")}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg"
                onClick={cancel}
                aria-label={t("cancelAudio")}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="relative py-1">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  ended ? "bg-muted-foreground/50" : "bg-primary/30",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={sliderValue}
              disabled={duration <= 0}
              aria-label={t("audioSeek")}
              className={cn(
                "relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent",
                "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
                "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
                "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
                "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary",
              )}
              onPointerDown={() => setSeeking(true)}
              onPointerUp={() => setSeeking(false)}
              onPointerCancel={() => setSeeking(false)}
              onChange={(e) => {
                const next = Number(e.target.value);
                setCurrentTime(next);
                seekTo(next);
              }}
            />
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{playing ? t("audioPlaying") : ended ? t("audioFinished") : t("audioPaused")}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      ) : null}
    </>
  );
});
