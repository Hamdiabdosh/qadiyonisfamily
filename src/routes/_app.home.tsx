import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, GitBranch } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchAllMembers } from "@/lib/family";

export const Route = createFileRoute("/_app/home")({
  ssr: false,
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: members = [] } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
  });

  const me = members.find(m => m.full_name === user?.fullName);

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-6 px-4 pb-4 pt-2">
        <PageTitleRow
          title={t("home")}
          description={`Welcome back, ${user?.fullName?.split(" ")[0] || "Family"}`}
        />

        {me && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <GitBranch className="size-5 text-primary" />
                <div>
                  <p className="font-semibold">Your Lineage</p>
                  <p className="text-sm text-muted-foreground">Quick view of your roots</p>
                </div>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link to="/tree">View My Full Lineage</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button asChild size="lg" className="h-24 flex-col gap-1">
            <Link to="/add-family">
              <Plus className="size-6" />
              Add Member
            </Link>
          </Button>

          <Button asChild size="lg" variant="outline" className="h-24 flex-col gap-1">
            <Link to="/kin">
              <Users className="size-6" />
              Find Family
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="font-medium mb-2">Need help?</p>
            <p className="text-sm text-muted-foreground mb-4">
              Ask our family assistant or contact admins
            </p>
            <Button variant="secondary" className="w-full">Chat with Family Bot</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
