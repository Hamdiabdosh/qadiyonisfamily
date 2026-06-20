import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { getSessionFn } from "@/lib/api/auth.functions";
import { PageTitleRow } from "@/components/PageTitleRow";
import { AddFamilyForm } from "@/components/AddFamilyForm";
import { useI18n } from "@/lib/i18n";

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

  return (
    <div>
      <AppHeader />
      <div className="page-content px-4 pb-4 pt-2">
        <PageTitleRow title={t("addFamily")} className="mb-2" />
        <AddFamilyForm />
      </div>
    </div>
  );
}
