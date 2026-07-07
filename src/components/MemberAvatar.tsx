import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveMediaUrl } from "@/lib/media-url";
import { statusRing, type StatusKind } from "@/lib/family";
import { cn } from "@/lib/utils";

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASS = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-20 w-20 text-base",
} as const;

type Props = {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  status?: StatusKind;
  className?: string;
};

export function MemberAvatar({ name, photoUrl, size = "md", status, className }: Props) {
  const src = resolveMediaUrl(photoUrl, size === "xs" || size === "sm" ? "thumb" : "card");

  return (
    <Avatar
      className={cn(
        SIZE_CLASS[size],
        status && statusRing[status],
        className,
      )}
    >
      {src ? <AvatarImage src={src} alt={name} className="object-cover" /> : null}
      <AvatarFallback className="bg-muted font-semibold text-muted-foreground">
        {memberInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
