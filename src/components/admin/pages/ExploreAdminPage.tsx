import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SocialIcon, SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "@/components/SocialIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSettingsFn, updateSettingsFn } from "@/lib/api/content.functions";
import {
  createExplorePostFn,
  createGalleryItemFn,
  createSocialLinkFn,
  deleteExplorePostFn,
  deleteGalleryItemFn,
  deleteSocialLinkFn,
  getExploreAdminFn,
  uploadExploreAudioFn,
  uploadExploreImageFn,
} from "@/lib/api/explore.functions";
import { readFileAsBase64 } from "@/lib/file-base64";
import { resolveMediaUrl } from "@/lib/media-url";

const SOCIAL_PLATFORMS: SocialPlatform[] = ["telegram", "youtube", "tiktok", "facebook"];

function MediaFileField({
  id,
  label,
  accept,
  hint,
  previewUrl,
  uploading,
  multiple,
  onFile,
  onFiles,
}: {
  id: string;
  label: string;
  accept: string;
  hint: string;
  previewUrl?: string | null;
  uploading: boolean;
  multiple?: boolean;
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={uploading}
        onChange={(e) => {
          const selected = e.target.files ? Array.from(e.target.files) : [];
          if (selected.length === 0) return;
          if (multiple && onFiles) onFiles(selected);
          else if (onFile) onFile(selected[0]);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
      {previewUrl ? (
        accept.startsWith("image") ? (
          <img src={previewUrl} alt="" className="mt-2 aspect-video max-h-40 w-full rounded-lg object-cover" />
        ) : (
          <audio controls src={previewUrl} className="mt-2 w-full" />
        )
      ) : null}
    </div>
  );
}

export function ExploreAdminPage() {
  const qc = useQueryClient();
  const { data = { posts: [], gallery: [], social: [] }, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "explore"],
    queryFn: getExploreAdminFn,
  });
  const { data: settings = {} } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: getSettingsFn,
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [fileLink, setFileLink] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [category, setCategory] = useState<"story" | "book">("story");
  const [shareKin, setShareKin] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryFeatured, setGalleryFeatured] = useState(false);
  const [galleryShareKin, setGalleryShareKin] = useState(true);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [galleryTelegram, setGalleryTelegram] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);

  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>("telegram");
  const [socialName, setSocialName] = useState("");
  const [socialUrl, setSocialUrl] = useState("");

  useEffect(() => {
    setGalleryTelegram(String(settings.gallery_telegram_group_url ?? ""));
  }, [settings.gallery_telegram_group_url]);

  const invalidate = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ["admin", "explore"] }),
      qc.invalidateQueries({ queryKey: ["explore"] }),
      qc.invalidateQueries({ queryKey: ["gallery"] }),
      qc.invalidateQueries({ queryKey: ["public-settings"] }),
    ]);
  };

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPEG, PNG, WebP, or GIF).");
      return;
    }
    setUploadingCover(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const { url } = await uploadExploreImageFn({ data: { fileBase64, mimeType: file.type } });
      setCoverUrl(url);
      toast.success("Cover image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadAudio = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please choose an audio file (MP3, WAV, OGG, WebM, or M4A).");
      return;
    }
    setUploadingAudio(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const { url } = await uploadExploreAudioFn({ data: { fileBase64, mimeType: file.type } });
      setAudioUrl(url);
      toast.success("Audio uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingAudio(false);
    }
  };

  const addPost = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and reading text are required");
    try {
      await createExplorePostFn({
        data: {
          title: title.trim(),
          body: body.trim(),
          imageUrl: coverUrl || undefined,
          fileLink: fileLink.trim() || undefined,
          youtubeUrl: youtubeUrl.trim() || undefined,
          audioUrl: audioUrl || undefined,
          category,
          shareWithKin: shareKin,
        },
      });
      toast.success("Story / book published");
      setTitle("");
      setBody("");
      setCoverUrl("");
      setFileLink("");
      setYoutubeUrl("");
      setAudioUrl("");
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish story / book");
    }
  };

  const uploadGalleryImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      toast.error("Please choose one or more image files.");
      return;
    }
    setUploadingGallery(true);
    try {
      let added = 0;
      for (const file of images) {
        const fileBase64 = await readFileAsBase64(file);
        const { url } = await uploadExploreImageFn({ data: { fileBase64, mimeType: file.type } });
        await createGalleryItemFn({
          data: {
            imageUrl: url,
            caption: galleryCaption.trim() || undefined,
            isFeatured: galleryFeatured,
            shareWithKin: galleryShareKin,
          },
        });
        added++;
      }
      toast.success(added === 1 ? "Gallery image added" : `${added} gallery images added`);
      setGalleryCaption("");
      setGalleryFeatured(false);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingGallery(false);
    }
  };

  const saveGalleryTelegram = async () => {
    setSavingTelegram(true);
    try {
      await updateSettingsFn({
        data: { gallery_telegram_group_url: galleryTelegram.trim() },
      });
      toast.success("Gallery Telegram link saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingTelegram(false);
    }
  };

  const addSocial = async () => {
    if (!socialName.trim() || !socialUrl.trim()) return toast.error("Creator name and profile URL are required");
    try {
      new URL(socialUrl.trim());
    } catch {
      return toast.error("Enter a valid profile URL");
    }
    await createSocialLinkFn({
      data: {
        platform: socialPlatform,
        accountName: socialName.trim(),
        url: socialUrl.trim(),
        sortOrder: data.social.length,
      },
    });
    toast.success("Social link added");
    setSocialName("");
    setSocialUrl("");
    invalidate();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stories &amp; Books</CardTitle>
          <CardDescription>
            Detailed reading for kin. Upload a cover from your device, optional Telegram file link, YouTube video, or
            audio narration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as "story" | "book")}>
              <SelectTrigger>
                <SelectValue placeholder="Choose story or book" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="story">Story</SelectItem>
                <SelectItem value="book">Book</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The journey of our ancestors"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reading (full text)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write the full story or book chapter here. Kin will read this on a dedicated page."
            />
          </div>
          <MediaFileField
            id="post-cover"
            label="Cover image (upload from device)"
            accept="image/*"
            hint="JPEG, PNG, WebP, or GIF — max 10 MB. Shown on Explore and the reading page."
            previewUrl={coverUrl ? resolveMediaUrl(coverUrl) : null}
            uploading={uploadingCover}
            onFile={(file) => void uploadCover(file)}
          />
          <div className="space-y-1.5">
            <Label>YouTube video URL (optional)</Label>
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
            />
          </div>
          <MediaFileField
            id="post-audio"
            label="Audio narration (upload from device, optional)"
            accept="audio/*"
            hint="MP3, WAV, OGG, WebM, or M4A — max 15 MB. Played on the reading page."
            previewUrl={audioUrl ? resolveMediaUrl(audioUrl) : null}
            uploading={uploadingAudio}
            onFile={(file) => void uploadAudio(file)}
          />
          <div className="space-y-1.5">
            <Label>Telegram file / group link (optional)</Label>
            <Input
              value={fileLink}
              onChange={(e) => setFileLink(e.target.value)}
              placeholder="https://t.me/…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={shareKin} onCheckedChange={setShareKin} /> Show on Explore page
          </label>
          <Button onClick={() => void addPost()}>Publish</Button>

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Published stories &amp; books</h3>
              <span className="text-xs text-muted-foreground">
                {isLoading || isFetching ? "Loading…" : `${data.posts.length} saved`}
              </span>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading published items…</p>
            ) : data.posts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                Nothing published yet. Fill in the form above and click Publish — your saved items will appear here.
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.posts.map((p) => (
                  <Card key={p.id} className="overflow-hidden">
                    <CardContent className="space-y-2 pt-4">
                      {p.imageUrl ? (
                        <img
                          src={resolveMediaUrl(p.imageUrl) ?? ""}
                          alt=""
                          className="aspect-video w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground">
                          No cover image
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          {p.category}
                        </span>
                        {!p.shareWithKin ? (
                          <span className="text-[10px] text-muted-foreground">Hidden from Explore</span>
                        ) : null}
                      </div>
                      <p className="font-medium leading-snug">{p.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-3">{p.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.publishedAt).toLocaleString()}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await deleteExplorePostFn({ data: { id: p.id } });
                          await invalidate();
                          toast.success("Deleted");
                        }}
                      >
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gallery</CardTitle>
          <CardDescription>
            Upload images from your device. Featured images appear two-at-a-time on Explore. All images appear on the
            Gallery page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Caption (applies to all images in this batch)</Label>
            <Input
              value={galleryCaption}
              onChange={(e) => setGalleryCaption(e.target.value)}
              placeholder="Describe this moment or family event"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={galleryFeatured} onCheckedChange={setGalleryFeatured} /> Featured on Explore preview
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={galleryShareKin} onCheckedChange={setGalleryShareKin} /> Show on Explore / Gallery
          </label>
          <MediaFileField
            id="gallery-image"
            label="Images (upload from device)"
            accept="image/*"
            multiple
            hint={
              uploadingGallery
                ? "Uploading images…"
                : "Select one or many images at once. The caption and switches above apply to every image in the batch."
            }
            previewUrl={null}
            uploading={uploadingGallery}
            onFiles={(files) => void uploadGalleryImages(files)}
          />

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Saved gallery images</h3>
              <span className="text-xs text-muted-foreground">{data.gallery.length} saved</span>
            </div>
            {data.gallery.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No gallery images yet. Upload one or more images above and they will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.gallery.map((g) => (
                  <Card key={g.id} className="overflow-hidden">
                    <img
                      src={resolveMediaUrl(g.imageUrl) ?? ""}
                      alt={g.caption ?? ""}
                      className="aspect-square w-full object-cover"
                    />
                    <CardContent className="space-y-2 p-2">
                      <p className="text-xs line-clamp-2">{g.caption ?? "—"}</p>
                      <div className="flex flex-wrap gap-1">
                        {g.isFeatured ? (
                          <span className="text-[10px] font-medium text-primary">Featured</span>
                        ) : null}
                        {!g.shareWithKin ? (
                          <span className="text-[10px] text-muted-foreground">Hidden</span>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          await deleteGalleryItemFn({ data: { id: g.id } });
                          await invalidate();
                          toast.success("Deleted");
                        }}
                      >
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gallery — View More link</CardTitle>
          <CardDescription>
            Private Telegram group link for the &quot;View More Gallery&quot; button on the Gallery page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Telegram group link</Label>
            <Input
              value={galleryTelegram}
              onChange={(e) => setGalleryTelegram(e.target.value)}
              placeholder="https://t.me/+your_private_group"
            />
          </div>
          <Button variant="outline" disabled={savingTelegram} onClick={() => void saveGalleryTelegram()}>
            {savingTelegram ? "Saving…" : "Save Telegram link"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social media — featured creators</CardTitle>
          <CardDescription>
            Add as many links as you like — multiple Telegram, YouTube, TikTok, and Facebook profiles. Each link opens
            the creator&apos;s profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={socialPlatform} onValueChange={(v) => setSocialPlatform(v as SocialPlatform)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose platform" />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {SOCIAL_PLATFORM_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Creator / account name</Label>
            <Input
              value={socialName}
              onChange={(e) => setSocialName(e.target.value)}
              placeholder="@wadehlife or channel name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Profile URL</Label>
            <Input
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
              placeholder="https://youtube.com/@… or https://t.me/…"
            />
          </div>
          <Button onClick={() => void addSocial()}>Add social link</Button>

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Saved social links</h3>
              <span className="text-xs text-muted-foreground">{data.social.length} saved</span>
            </div>
            {data.social.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No social links yet. Add creator profiles above and they will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {data.social.map((link) => (
            <div key={link.id} className="flex items-center gap-3 rounded-lg border p-3">
              <SocialIcon platform={link.platform} className="size-5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase text-muted-foreground">
                  {SOCIAL_PLATFORM_LABELS[link.platform]}
                </p>
                <p className="truncate font-medium">{link.accountName}</p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-primary hover:underline"
                >
                  {link.url}
                </a>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await deleteSocialLinkFn({ data: { id: link.id } });
                  await invalidate();
                  toast.success("Deleted");
                }}
              >
                Delete
              </Button>
            </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
