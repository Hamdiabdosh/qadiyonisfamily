import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Compass,
  Contact,
  Copy,
  Download,
  GitBranch,
  Languages,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  TreePine,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { BuiltByRaafat } from "@/components/brand/built-by-raafat";
import { useAuth } from "@/lib/auth";
import type { AdminCounts, AdminView } from "./types";

const NAV: { view: AdminView; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "approval", label: "Approval", icon: CheckCircle },
  { view: "accounts", label: "Accounts", icon: UserPlus },
  { view: "family", label: "Family", icon: Users },
  { view: "duplicates", label: "Duplicates", icon: Copy },
  { view: "incomplete", label: "Incomplete", icon: AlertCircle },
  { view: "export", label: "Export", icon: Download },
  { view: "tree", label: "Tree", icon: GitBranch },
  { view: "kin", label: "Kin page", icon: Contact },
  { view: "explore", label: "Explore", icon: Compass },
  { view: "feedbacks", label: "Feedbacks", icon: MessageSquare },
  { view: "announcements", label: "Announcements", icon: Megaphone },
  { view: "notifications", label: "Notifications", icon: Bell },
  { view: "translations", label: "Translations", icon: Languages },
  { view: "settings", label: "Settings", icon: Settings },
];

type Props = {
  active: AdminView;
  counts: AdminCounts;
};

export function AdminSidebar({ active, counts }: Props) {
  const nav = useNavigate();
  const { user, signOut } = useAuth();

  const badgeFor = (view: AdminView) => {
    if (view === "approval" && counts.pending > 0) return counts.pending;
    if (view === "accounts" && counts.accounts > 0) return counts.accounts;
    if (view === "feedbacks" && counts.feedbacks > 0) return counts.feedbacks;
    if (view === "notifications" && counts.notifications > 0) return counts.notifications;
    return null;
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-root text-root-foreground text-sm font-bold">
                Q
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Qadi Yonis</span>
                <span className="truncate text-xs text-muted-foreground">Admin Dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ view, label, icon: Icon }) => (
                <SidebarMenuItem key={view}>
                  <SidebarMenuButton
                    isActive={active === view}
                    tooltip={label}
                    onClick={() => nav({ to: "/admin", search: { view } })}
                  >
                    <Icon />
                    <span>{label}</span>
                    {badgeFor(view) != null && (
                      <SidebarMenuBadge>{badgeFor(view)}</SidebarMenuBadge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>App</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Family App">
                  <Link to="/home">
                    <TreePine />
                    <span>Family App</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="pointer-events-none" tooltip={user?.email ?? "Admin"}>
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {user?.email?.[0]?.toUpperCase() ?? "A"}
              </div>
              <span className="truncate text-xs">{user?.email ?? "Admin"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={async () => {
                await signOut();
                nav({ to: "/auth" });
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-2">
          <BuiltByRaafat className="text-center text-[10px] text-sidebar-foreground/60" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
