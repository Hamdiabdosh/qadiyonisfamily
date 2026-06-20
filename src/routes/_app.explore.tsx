import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Compass, ExternalLink, FileText, ImageIcon } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { SocialIcon, SOCIAL_PLATFORM_COLORS, SOCIAL_PLATFORM_LABELS } from "@/components/SocialIcon";
import { OptimizedImage } from "@/components/OptimizedImage";
import { resolveMediaUrl } from "@/lib/media-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExploreContentFn } from "@/lib/api/explore.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/explore")({
  ssr: false,
  component: ExplorePage,
});

function SectionEmpty({ message }: { message: string }) {
  return (
    <Card className="border-dashed border-border/70 bg-muted/20">
      <CardContent className="py-8 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

function ExplorePage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["explore"],
    queryFn: getExploreContentFn,
  });

  const posts = data?.posts ?? [];
  const galleryPreview = data?.galleryPreview ?? [];
  const social = data?.social ?? [];

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-6 px-4 pb-4 pt-2">
        <PageTitleRow
          title={t("explore")}
          icon={<Compass className="size-5 shrink-0 text-primary drop-shadow-[0_0_8px_var(--glow-primary)]" />}
        />

        {isLoading ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("exploreStoriesBooks")}
          </h3>
          {posts.length === 0 ? (
            <SectionEmpty message={t("exploreNoStories")} />
          ) : (
            <div className="stagger-children space-y-3">
              {posts.map((post) => {
                const cover = resolveMediaUrl(post.imageUrl, "card");
                return (
                  <Card key={post.id} className="overflow-hidden border-primary/15 shadow-sm">
                    <Link to="/explore/$postId" params={{ postId: String(post.id) }}>
                      {cover ? (
                        <OptimizedImage
                          src={cover}
                          alt=""
                          aspectClassName="aspect-[2/1]"
                          className="w-full"
                        />
                      ) : (
                        <div className="flex aspect-[3/1] items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                          {post.category === "book" ? (
                            <BookOpen className="size-10 text-primary/40" />
                          ) : (
                            <FileText className="size-10 text-primary/40" />
                          )}
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                          {post.category === "book" ? t("exploreBook") : t("exploreStory")}
                        </p>
                        <CardTitle className="text-base leading-snug">{post.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap line-clamp-3">
                          {post.body}
                        </p>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                          {t("exploreReadMore")}
                          <ChevronRight className="size-4" />
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.publishedAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("exploreGallery")}
          </h3>
          <Card className="overflow-hidden border-primary/15">
            <CardContent className="space-y-3 p-3">
              {galleryPreview.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <ImageIcon className="size-8 text-primary/30" />
                  {t("exploreNoGallery")}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {galleryPreview.map((item, index) => (
                    <figure key={item.id} className="gallery-card overflow-hidden rounded-lg">
                      <OptimizedImage
                        src={resolveMediaUrl(item.imageUrl, "thumb")}
                        alt={item.caption ?? ""}
                        priority={index < 2}
                        className="w-full"
                      />
                      {item.caption ? (
                        <figcaption className="line-clamp-2 p-1.5 text-[10px] text-muted-foreground">
                          {item.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link to="/gallery">{t("viewGallery")}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("exploreSocial")}
          </h3>
          {social.length === 0 ? (
            <SectionEmpty message={t("exploreNoSocial")} />
          ) : (
            <div className="grid gap-2">
              {social.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl shadow-sm",
                      SOCIAL_PLATFORM_COLORS[link.platform],
                    )}
                  >
                    <SocialIcon platform={link.platform} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {SOCIAL_PLATFORM_LABELS[link.platform]}
                    </p>
                    <p className="truncate font-semibold">{link.accountName}</p>
                  </div>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
