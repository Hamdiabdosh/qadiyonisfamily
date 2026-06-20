import { useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  /** First visible image — loads eagerly */
  priority?: boolean;
  aspectClassName?: string;
};

export function OptimizedImage({
  src,
  alt = "",
  className,
  priority = false,
  aspectClassName = "aspect-square",
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn("animate-pulse bg-muted/60", aspectClassName, className)}
        aria-hidden={!alt}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted/30", aspectClassName, className)}>
      {!loaded ? <div className="absolute inset-0 animate-pulse bg-muted/50" aria-hidden /> : null}
      <img
        src={src}
        alt={alt}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
