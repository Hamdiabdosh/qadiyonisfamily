import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { InstallAppButton } from "@/components/InstallAppButton";
import { AdminNotificationsBell } from "./AdminNotificationsBell";
import { AdminPushWatcher } from "./AdminPushWatcher";
import { AdminSidebar } from "./AdminSidebar";
import type { AdminCounts, AdminView } from "./types";

const TITLES: Record<AdminView, { title: string; description: string }> = {
  dashboard: { title: "Dashboard", description: "Analytics and overview of the family tree" },
  approval: { title: "Approval", description: "Review pending family submissions" },
  accounts: { title: "Accounts", description: "Search members, approve requests, and manage admin or member roles" },
  family: { title: "Family", description: "Manage approved family members" },
  duplicates: { title: "Duplicate Detection", description: "Review same-name groups and dismiss legitimate matches" },
  incomplete: { title: "Incomplete", description: "Members missing parent links and not linked by marriage" },
  export: { title: "Export", description: "Download family data as CSV, JSON, or GEDCOM" },
  tree: { title: "Family Tree", description: "Visual canvas of the full lineage" },
  kin: { title: "Kin Directory", description: "Kin page layout and member directory settings" },
  explore: { title: "Explore", description: "Posts and gallery shared with kin" },
  feedbacks: { title: "Feedbacks", description: "Reports and messages from members" },
  announcements: { title: "Announcements", description: "Post updates for all members" },
  notifications: { title: "Notifications", description: "Admin alerts and activity" },
  translations: { title: "Translations", description: "Manage app text in English and Amharic" },
  settings: { title: "Settings", description: "App configuration and homepage video" },
};

type Props = {
  view: AdminView;
  counts: AdminCounts;
  children: ReactNode;
};

export function AdminLayout({ view, counts, children }: Props) {
  const meta = TITLES[view];

  return (
    <SidebarProvider>
      <AdminPushWatcher />
      <AdminSidebar active={view} counts={counts} />
      <SidebarInset>
        <header className="header-glass flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{meta.title}</h1>
              <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
            </div>
            <InstallAppButton showLabel className="shrink-0" />
          </div>
          <AdminNotificationsBell />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
