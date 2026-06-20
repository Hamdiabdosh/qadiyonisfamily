import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Images } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OptimizedImage } from "@/components/OptimizedImage";
import { getGalleryContentFn } from "@/lib/api/explore.functions";
import { resolveMediaUrl } from "@/lib/media-url";
import { useI18n } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/gallery")({
  ssr: false,
  component: GalleryPage,
});

function GalleryPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: getGalleryContentFn,
  });
  const gallery = data?.gallery ?? [];
  const galleryTelegramUrl = data?.galleryTelegramUrl ?? "";

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-4 px-4 pb-4 pt-2">
        <PageTitleRow
          title={t("galleryPageTitle")}
          icon={<Images className="size-5 shrink-0 text-primary" />}
          leading={
            <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
              <Link to="/explore">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          }
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : gallery.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("galleryEmpty")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.map((item, index) => (
              <figure key={item.id} className="gallery-card overflow-hidden rounded-xl border bg-card shadow-sm">
                <OptimizedImage
                  src={resolveMediaUrl(item.imageUrl, "thumb")}
                  alt={item.caption ?? ""}
                  priority={index < 4}
                  className="w-full"
                />
                {item.caption ? (
                  <figcaption className="line-clamp-3 p-2 text-xs text-muted-foreground">
                    {item.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}

        {galleryTelegramUrl ? (
          <Button asChild className="w-full" size="lg">
            <a href={galleryTelegramUrl} target="_blank" rel="noopener noreferrer">
              {t("viewMoreGallery")}
              <ExternalLink className="ml-2 size-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
