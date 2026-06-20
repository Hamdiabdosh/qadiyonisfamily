import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ExternalLink, FileText } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { SocialIcon } from "@/components/SocialIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getExplorePostFn } from "@/lib/api/explore.functions";
import { useI18n } from "@/lib/i18n";
import { OptimizedImage } from "@/components/OptimizedImage";
import { resolveMediaUrl } from "@/lib/media-url";
import { youtubeEmbedUrl } from "@/lib/youtube";

export const Route = createFileRoute("/_app/explore/$postId")({
  ssr: false,
  component: ExplorePostPage,
});

function ExplorePostPage() {
  const { t } = useI18n();
  const { postId } = Route.useParams();
  const id = Number(postId);

  const { data: post, isLoading } = useQuery({
    queryKey: ["explore-post", id],
    queryFn: () => getExplorePostFn({ data: { id } }),
    enabled: Number.isFinite(id) && id > 0,
  });

  const cover = resolveMediaUrl(post?.imageUrl, "card");
  const audio = resolveMediaUrl(post?.audioUrl);
  const embed = youtubeEmbedUrl(post?.youtubeUrl);

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-4 px-4 pb-6 pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/explore">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <p className="text-sm font-medium text-muted-foreground">{t("explore")}</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : !post ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("explorePostNotFound")}
            </CardContent>
          </Card>
        ) : (
          <article className="space-y-4">
            {cover ? (
              <OptimizedImage
                src={cover}
                alt=""
                priority
                aspectClassName="aspect-[2/1]"
                className="w-full rounded-2xl shadow-md"
              />
            ) : (
              <div className="flex aspect-[3/1] items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
                {post.category === "book" ? (
                  <BookOpen className="size-12 text-primary/40" />
                ) : (
                  <FileText className="size-12 text-primary/40" />
                )}
              </div>
            )}

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                {post.category === "book" ? t("exploreBook") : t("exploreStory")}
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-snug">{post.title}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(post.publishedAt).toLocaleDateString()}
              </p>
            </div>

            {embed ? (
              <div className="overflow-hidden rounded-xl bg-muted shadow-inner ring-1 ring-primary/10">
                <div className="aspect-video w-full">
                  <iframe
                    src={embed}
                    title={post.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : null}

            {audio ? (
              <Card className="border-primary/15">
                <CardContent className="space-y-2 p-4">
                  <p className="text-sm font-medium">{t("exploreListenAudio")}</p>
                  <audio controls src={audio} className="w-full" preload="metadata" />
                </CardContent>
              </Card>
            ) : null}

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">{post.body}</p>
            </div>

            {post.fileLink ? (
              <a
                href={post.fileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#26A5E4]/40 bg-[#26A5E4]/10 px-4 py-3 text-sm font-medium text-[#26A5E4] transition-colors hover:bg-[#26A5E4]/20"
              >
                <SocialIcon platform="telegram" className="size-4" />
                {t("exploreGetFileTelegram")}
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
            ) : null}
          </article>
        )}
      </div>
    </div>
  );
}
