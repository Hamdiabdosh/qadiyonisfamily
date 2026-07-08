import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AccountsPage } from "@/components/admin/pages/AccountsPage";
import { AdminNotificationsPage } from "@/components/admin/pages/AdminNotificationsPage";
import { AdminTreePage } from "@/components/admin/pages/AdminTreePage";
import { AnnouncementsPage } from "@/components/admin/pages/AnnouncementsPage";
import { DashboardPage } from "@/components/admin/pages/DashboardPage";
import { DuplicatesPage } from "@/components/admin/pages/DuplicatesPage";
import { ExploreAdminPage } from "@/components/admin/pages/ExploreAdminPage";
import { KinAdminPage } from "@/components/admin/pages/KinAdminPage";
import { FeedbacksPage } from "@/components/admin/pages/FeedbacksPage";
import { MembersPage } from "@/components/admin/pages/MembersPage";
import { PendingPage } from "@/components/admin/pages/PendingPage";
import { SettingsPage } from "@/components/admin/pages/SettingsPage";
import { TranslationsPage } from "@/components/admin/pages/TranslationsPage";
import type { AdminActions, AdminData, AdminView } from "@/components/admin/types";
import { buildExports, findDuplicates } from "@/components/admin/utils";
import { getSessionFn, getAccountsAdminFn } from "@/lib/api/auth.functions";
import { getAdminNotificationsFn, getFeedbacksFn } from "@/lib/api/content.functions";
import {
  approveMember,
  approveFamilySubmission,
  deleteMember,
  dismissDuplicateGroup,
  fetchAllMembers,
  fetchDismissedDuplicateGroups,
  fetchPending,
  fetchPendingSubmissions,
  rejectFamilySubmission,
  rejectMember,
  updateApprovedFamily,
  updateFamilySubmission,
  updateMemberAlive,
} from "@/lib/family";
import { useAuth } from "@/lib/auth";

const searchSchema = z.object({
  view: z
    .enum(["dashboard", "approval", "accounts", "family", "duplicates", "tree", "kin", "feedbacks", "announcements", "notifications", "explore", "translations", "settings"])
    .optional()
    .default("dashboard"),
});

export const Route = createFileRoute("/admin")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { user } = await getSessionFn();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const { view } = Route.useSearch();
  const qc = useQueryClient();

  const { data: pending = [] } = useQuery({ queryKey: ["admin", "pending"], queryFn: fetchPending });
  const { data: pendingSubmissions = [] } = useQuery({
    queryKey: ["admin", "pending-submissions"],
    queryFn: fetchPendingSubmissions,
  });
  const { data: approved = [] } = useQuery({ queryKey: ["admin", "approved"], queryFn: () => fetchAllMembers(false) });
  const { data: feedbacks = [] } = useQuery({ queryKey: ["admin", "feedbacks"], queryFn: getFeedbacksFn });
  const { data: adminNotifications = [] } = useQuery({ queryKey: ["admin", "notifications"], queryFn: getAdminNotificationsFn });
  const { data: accounts = [] } = useQuery({ queryKey: ["admin", "accounts"], queryFn: getAccountsAdminFn });
  const { data: dismissedDuplicateGroups = [] } = useQuery({
    queryKey: ["admin", "dismissed-duplicates"],
    queryFn: fetchDismissedDuplicateGroups,
  });

  const all = useMemo(() => [...approved, ...pending], [approved, pending]);
  const dismissedKeys = useMemo(() => new Set(dismissedDuplicateGroups), [dismissedDuplicateGroups]);
  const duplicates = useMemo(() => findDuplicates(all, dismissedKeys), [all, dismissedKeys]);
  const incomplete = useMemo(
    () => approved.filter((m) => !m.is_root && !m.father_id && !m.mother_id),
    [approved],
  );
  const exports = useMemo(() => buildExports(all), [all]);

  const data: AdminData = { pending, pendingSubmissions, approved, all, duplicates, incomplete };
  const counts = {
    pending: pendingSubmissions.length,
    members: approved.length,
    feedbacks: feedbacks.filter((f) => !f.isRead).length,
    notifications: adminNotifications.filter((n) => !n.isRead).length,
    accounts: accounts.filter((a) => a.accountStatus === "pending").length,
  };

  const actions: AdminActions = {
    approve: async (id) => {
      try {
        await approveMember(id);
        toast.success("Approved");
        qc.invalidateQueries({ queryKey: ["admin"] });
        qc.invalidateQueries({ queryKey: ["members"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    },
    reject: async (id) => {
      if (!confirm("Reject and delete this submission?")) return;
      try {
        await rejectMember(id);
        toast.success("Rejected");
        qc.invalidateQueries({ queryKey: ["admin"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    },
    remove: async (id) => {
      if (!confirm("Delete this member?")) return;
      try {
        await deleteMember(id);
        toast.success("Deleted");
        qc.invalidateQueries();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    },
    setAlive: async (id, isAlive) => {
      try {
        await updateMemberAlive(id, isAlive);
        toast.success(isAlive ? "Marked as alive" : "Marked as deceased");
        qc.invalidateQueries({ queryKey: ["admin"] });
        qc.invalidateQueries({ queryKey: ["members"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    },
    editFamilyUnit: async (form, memberIds) => {
      try {
        await updateApprovedFamily(form, memberIds);
        toast.success("Family updated");
        qc.invalidateQueries({ queryKey: ["admin"] });
        qc.invalidateQueries({ queryKey: ["members"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    },
    exportCSV: exports.exportCSV,
    exportJSON: exports.exportJSON,
    exportGEDCOM: exports.exportGEDCOM,
    saveSubmission: async (id, form) => {
      await updateFamilySubmission(id, form);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    approveSubmission: async (id) => {
      await approveFamilySubmission(id);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    rejectSubmission: async (id) => {
      await rejectFamilySubmission(id);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    dismissDuplicateGroup: async (groupKey) => {
      try {
        await dismissDuplicateGroup(groupKey);
        toast.success("Marked as not a duplicate");
        qc.invalidateQueries({ queryKey: ["admin", "dismissed-duplicates"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    },
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <h2 className="text-lg font-semibold">Admin access only</h2>
          <p className="text-sm text-muted-foreground">Your account doesn&apos;t have admin privileges.</p>
          <Link to="/home"><Button variant="outline">Back to app</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AdminLayout view={view as AdminView} counts={counts}>
        <AdminBody view={view as AdminView} data={data} actions={actions} feedbackCount={feedbacks.length} />
      </AdminLayout>
    </div>
  );
}

function AdminBody({
  view,
  data,
  actions,
  feedbackCount,
}: {
  view: AdminView;
  data: AdminData;
  actions: AdminActions;
  feedbackCount: number;
}) {
  switch (view) {
    case "approval":
      return <PendingPage data={data} actions={actions} />;
    case "accounts":
      return <AccountsPage />;
    case "family":
      return <MembersPage data={data} actions={actions} />;
    case "duplicates":
      return <DuplicatesPage data={data} actions={actions} />;
    case "tree":
      return <AdminTreePage />;
    case "feedbacks":
      return <FeedbacksPage />;
    case "kin":
      return <KinAdminPage data={data} />;
    case "explore":
      return <ExploreAdminPage />;
    case "announcements":
      return <AnnouncementsPage />;
    case "notifications":
      return <AdminNotificationsPage />;
    case "translations":
      return <TranslationsPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <DashboardPage data={data} feedbackCount={feedbackCount} />;
  }
}
