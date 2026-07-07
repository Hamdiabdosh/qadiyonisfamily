import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { getSessionFn } from "@/lib/api/auth.functions";
import { PageTitleRow } from "@/components/PageTitleRow";
import { AddFamilyForm } from "@/components/AddFamilyForm";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { fetchAllMembers } from "@/lib/family";

export const Route = createFileRoute("/_app/add-family")({
  ssr: false,
  beforeLoad: async () => {
    const { user } = await getSessionFn();
    if (!user) {
      throw redirect({ to: "/auth", search: { redirect: "/add-family" } as never });
    }
  },
  component: AddFamilyPage,
});

function AddFamilyPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: members = [] } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
    enabled: !!user?.memberId,
  });
  const selfMember = members.find((m) => m.id === user?.memberId) ?? null;
  const mode = selfMember?.gender === "male" ? "extendSelf" : "newFamily";

  return (
    <div>
      <AppHeader />
      <div className="page-content px-4 pb-4 pt-2">
        <PageTitleRow title={t("addFamily")} className="mb-2" />
        <AddFamilyForm
          mode={mode}
          selfMemberId={selfMember?.gender === "male" ? user?.memberId ?? null : null}
          defaultSubmitterName={user?.fullName ?? ""}
          defaultSubmitterPhone={user?.phone ?? ""}
        />
      </div>
    </div>
  );
}
