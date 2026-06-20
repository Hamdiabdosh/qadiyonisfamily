import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveAccountFn,
  getAccountsAdminFn,
  rejectAccountFn,
  setUserRoleFn,
  type AdminAccountRow,
} from "@/lib/api/auth.functions";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type RoleFilter = "all" | "admin" | "member";
type SortKey = "newest" | "oldest" | "name-asc" | "name-desc" | "status";

const STATUS_LABELS: Record<AdminAccountRow["accountStatus"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function statusBadgeClass(status: AdminAccountRow["accountStatus"]) {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "approved":
      return "bg-primary/15 text-primary";
    case "rejected":
      return "bg-destructive/15 text-destructive";
  }
}

function filterAndSortAccounts(
  accounts: AdminAccountRow[],
  query: string,
  statusFilter: StatusFilter,
  roleFilter: RoleFilter,
  sort: SortKey,
) {
  const q = query.trim().toLowerCase();
  let rows = accounts.filter((a) => {
    if (statusFilter !== "all" && a.accountStatus !== statusFilter) return false;
    if (roleFilter !== "all" && a.role !== roleFilter) return false;
    if (!q) return true;
    return [a.fullName, a.phone, a.email, a.id]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "name-asc":
        return (a.fullName ?? "").localeCompare(b.fullName ?? "", undefined, { sensitivity: "base" });
      case "name-desc":
        return (b.fullName ?? "").localeCompare(a.fullName ?? "", undefined, { sensitivity: "base" });
      case "status":
        return a.accountStatus.localeCompare(b.accountStatus);
      case "newest":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return rows;
}

export function AccountsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: getAccountsAdminFn,
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterAndSortAccounts(accounts, query, statusFilter, roleFilter, sort),
    [accounts, query, statusFilter, roleFilter, sort],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "accounts"] });

  const approve = async (id: string) => {
    try {
      await approveAccountFn({ data: { id } });
      toast.success("Account approved");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve account");
    }
  };

  const reject = async (id: string) => {
    if (!confirm("Reject this account request?")) return;
    try {
      await rejectAccountFn({ data: { id } });
      toast.success("Account rejected");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject account");
    }
  };

  const changeRole = async (userId: string, role: "admin" | "member") => {
    setRoleSavingId(userId);
    try {
      await setUserRoleFn({ data: { userId, role } });
      toast.success(role === "admin" ? "User is now an admin" : "User is now a member");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change role");
    } finally {
      setRoleSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor="accounts-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="accounts-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, phone, or email…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
              <SelectItem value="status">By status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {isLoading ? "Loading accounts…" : `${filtered.length} of ${accounts.length} accounts`}
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No accounts match your search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{a.fullName ?? "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{a.phone ?? "—"}</p>
                    {a.email ? <p className="text-xs text-muted-foreground">{a.email}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Joined {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        statusBadgeClass(a.accountStatus),
                      )}
                    >
                      {STATUS_LABELS[a.accountStatus]}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        a.role === "admin" ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {a.role}
                    </span>
                  </div>
                </div>

                {a.accountStatus === "pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void approve(a.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void reject(a.id)}>
                      Reject
                    </Button>
                  </div>
                ) : null}

                {a.accountStatus === "approved" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Role</Label>
                    <Select
                      value={a.role}
                      disabled={roleSavingId === a.id}
                      onValueChange={(v) => void changeRole(a.id, v as "admin" | "member")}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {a.id === user?.id ? (
                      <p className="text-[11px] text-muted-foreground">
                        You cannot demote yourself. Sign in again after changing another user&apos;s role.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Admins can access the dashboard. Members use the family app only.
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
