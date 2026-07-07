import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/button";
import { readFileAsBase64 } from "@/lib/file-base64";
import { removeMemberPhoto, uploadMemberPhoto, type Member } from "@/lib/family";
import { useI18n } from "@/lib/i18n";

type Props = {
  member: Pick<Member, "id" | "full_name" | "photo_url">;
  size?: "md" | "lg" | "xl";
  onUpdated?: (patch: { photo_url: string | null }) => void;
  allowRemove?: boolean;
};

export function MemberPhotoUpload({ member, size = "xl", onUpdated, allowRemove = true }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const { filename } = await uploadMemberPhoto(member.id, fileBase64, file.type);
      await qc.invalidateQueries({ queryKey: ["members"] });
      onUpdated?.({ photo_url: filename });
      toast.success(t("photoUpdated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("photoUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    try {
      await removeMemberPhoto(member.id);
      await qc.invalidateQueries({ queryKey: ["members"] });
      onUpdated?.({ photo_url: null });
      toast.success(t("photoRemoved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("photoUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={t("changePhoto")}
      >
        <MemberAvatar name={member.full_name} photoUrl={member.photo_url} size={size} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-white" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="mr-1.5 size-3.5" />
          {member.photo_url ? t("changePhoto") : t("addPhoto")}
        </Button>
        {allowRemove && member.photo_url ? (
          <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={() => void handleRemove()}>
            <Trash2 className="mr-1.5 size-3.5" />
            {t("removePhoto")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
