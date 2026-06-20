import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSettingsFn,
  removeGuideAudioFn,
  updateSettingsFn,
  uploadGuideAudioFn,
} from "@/lib/api/content.functions";
import {
  DEFAULT_CONTACT_ADMINS,
  parseContactAdmins,
  serializeContactAdmins,
  type ContactAdmin,
} from "@/lib/contact-admins";
import type { GuideAudioSection } from "@/lib/uploads.server";
import { youtubeEmbedUrl } from "@/lib/youtube";

const GUIDE_SECTIONS: { section: GuideAudioSection; title: string; description: string }[] = [
  {
    section: "parents",
    title: "Parents section audio",
    description: "Plays when members open or focus the parents section (names, kin link, location).",
  },
  {
    section: "children",
    title: "Children section audio",
    description: "Plays when members open or focus the children section (sons, daughters, birth order).",
  },
  {
    section: "submitter",
    title: "Submitter section audio",
    description: "Plays when members open or focus submitter name, phone, and notes.",
  },
];

const SETTING_KEYS: Record<GuideAudioSection, string> = {
  parents: "add_family_audio_parents_filename",
  children: "add_family_audio_children_filename",
  submitter: "add_family_audio_submitter_filename",
  register: "register_audio_filename",
};

function GuideAudioUpload({
  section,
  title,
  description,
  filename,
  onUploaded,
}: {
  section: GuideAudioSection;
  title: string;
  description: string;
  filename?: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const audioUrl = filename ? `/uploads/${filename}` : "";

  const uploadAudio = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please choose an audio file (MP3, WAV, OGG, WebM, or M4A).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Audio file must be 15 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("Could not read audio file"));
            return;
          }
          const base64 = result.split(",")[1];
          if (!base64) {
            reject(new Error("Could not read audio file"));
            return;
          }
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Could not read audio file"));
        reader.readAsDataURL(file);
      });

      await uploadGuideAudioFn({ data: { fileBase64, mimeType: file.type, section } });
      toast.success(`${title} uploaded`);
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAudio = async () => {
    setRemoving(true);
    try {
      await removeGuideAudioFn({ data: { section } });
      toast.success(`${title} removed`);
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`guide-audio-${section}`}>{audioUrl ? "Replace audio file" : "Audio file"}</Label>
        <Input
          id={`guide-audio-${section}`}
          ref={inputRef}
          type="file"
          accept="audio/*"
          disabled={uploading || removing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAudio(file);
          }}
        />
        {audioUrl ? (
          <p className="text-xs text-muted-foreground">Choose a new file to replace the current audio.</p>
        ) : null}
      </div>
      {audioUrl ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Current file: {filename}</p>
          <audio controls preload="metadata" src={audioUrl} className="w-full max-w-md">
            Your browser does not support audio playback.
          </audio>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading || removing}
            onClick={() => void removeAudio()}
          >
            {removing ? "Removing…" : "Remove audio"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No audio uploaded yet.</p>
      )}
    </div>
  );
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings = {} } = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettingsFn });
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [contactAdmins, setContactAdmins] = useState<ContactAdmin[]>(DEFAULT_CONTACT_ADMINS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setYoutubeUrl(settings.youtube_video_url ?? "");
    setContactAdmins(parseContactAdmins(settings.contact_admins));
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await updateSettingsFn({
        data: {
          youtube_video_url: youtubeUrl.trim(),
          contact_admins: serializeContactAdmins(contactAdmins),
        },
      });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const preview = youtubeEmbedUrl(youtubeUrl);
  const legacyParents = settings.add_family_audio_filename;
  const invalidateAudio = () => {
    qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    qc.invalidateQueries({ queryKey: ["public-settings"] });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign-up audio guide</CardTitle>
          <CardDescription>
            Plays at the top of the sign-up form when a user focuses the full name field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuideAudioUpload
            section="register"
            title="Register — full name field"
            description="Short audio for endogamous kin (mother and father lines to Qadi Yonis)."
            filename={settings.register_audio_filename}
            onUploaded={invalidateAudio}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Family audio guides</CardTitle>
          <CardDescription>
            Upload one audio file per form section. Each plays when that section is opened or focused.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {GUIDE_SECTIONS.map(({ section, title, description }) => (
            <GuideAudioUpload
              key={section}
              section={section}
              title={title}
              description={description}
              filename={
                settings[SETTING_KEYS[section]] ??
                (section === "parents" ? legacyParents : undefined)
              }
              onUploaded={invalidateAudio}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homepage instruction video</CardTitle>
          <CardDescription>Paste a YouTube URL — it appears on the member homepage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>YouTube video URL</Label>
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
          {preview && (
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              <iframe src={preview} title="Preview" className="h-full w-full" allowFullScreen />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact admins (Profile page)</CardTitle>
          <CardDescription>
            Shown side by side in the Contact Admin section on the member profile page.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {contactAdmins.map((admin, index) => (
            <div key={index} className="space-y-3 rounded-lg border border-border/60 p-4">
              <p className="text-sm font-medium">Admin {index + 1}</p>
              <div className="space-y-1.5">
                <Label>Label (optional)</Label>
                <Input
                  value={admin.label ?? ""}
                  onChange={(e) =>
                    setContactAdmins((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)),
                    )
                  }
                  placeholder="e.g. Family coordinator"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={admin.phone}
                  onChange={(e) =>
                    setContactAdmins((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, phone: e.target.value } : row)),
                    )
                  }
                  placeholder="0911357612"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telegram username</Label>
                <Input
                  value={admin.telegram}
                  onChange={(e) =>
                    setContactAdmins((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, telegram: e.target.value } : row)),
                    )
                  }
                  placeholder="lahek11"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>Save settings</Button>
    </div>
  );
}
