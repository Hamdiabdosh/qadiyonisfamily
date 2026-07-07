import "@/lib/client-buffer-shim";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "@/lib/i18n";
import { SettingsProvider } from "@/lib/settings";
import { AuthProvider } from "@/lib/auth";
import { PwaInstallProvider } from "@/lib/pwa-install";
import { InstallAppDialog } from "@/components/InstallAppDialog";
import { LanguageOnboardingDialog } from "@/components/LanguageOnboardingDialog";
import { APP_URL } from "@/lib/app-url";

function NotFoundComponent() {
  return (
    <div className="app-shell relative flex min-h-screen items-center justify-center px-4">
      <div className="app-mesh" aria-hidden />
      <div className="relative z-10 max-w-md text-center page-content">
        <h1 className="text-7xl font-bold text-primary drop-shadow-[0_0_24px_var(--glow-primary)]">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-gradient-to-br from-primary to-primary/85 px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="app-shell relative flex min-h-screen items-center justify-center px-4">
      <div className="app-mesh" aria-hidden />
      <div className="relative z-10 max-w-md text-center page-content">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-xl bg-gradient-to-br from-primary to-primary/85 px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25">Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Qadi Yonis — Family Tree & Lineage" },
      {
        name: "description",
        content:
          "Preserve, search, and connect with the Qadi Yonis family lineage. Register kin, explore generations, and submit your family branch.",
      },
      { name: "theme-color", content: "#2f7d4f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Qadi Yonis" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "googlebot", content: "index, follow" },
      { property: "og:site_name", content: "Qadi Yonis" },
      { property: "og:title", content: "Qadi Yonis — Family Tree & Lineage" },
      {
        property: "og:description",
        content: "Family lineage of Qadi Yonis — preserve, search, and connect with your kin.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: APP_URL },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: `${APP_URL}/icon-512.png` },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Qadi Yonis — Family Tree" },
      {
        name: "twitter:description",
        content: "Preserve and explore the Qadi Yonis family lineage.",
      },
      { name: "twitter:image", content: `${APP_URL}/icon-512.png` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon-192.png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icon-512.png", sizes: "512x512" },
      { rel: "canonical", href: `${APP_URL}/` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Qadi Yonis Family Tree",
          url: APP_URL,
          description: "Family lineage app for the Qadi Yonis kin network.",
          applicationCategory: "SocialNetworkingApplication",
          operatingSystem: "Web",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <I18nProvider>
          <AuthProvider>
            <PwaInstallProvider>
              <Outlet />
              <LanguageOnboardingDialog />
              <InstallAppDialog />
              <Toaster position="top-center" richColors />
            </PwaInstallProvider>
          </AuthProvider>
        </I18nProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
