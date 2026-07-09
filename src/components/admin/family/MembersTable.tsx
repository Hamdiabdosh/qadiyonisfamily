import { useMemo } from "react";

import { MemberAvatar } from "@/components/MemberAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Member } from "@/lib/family";
import { memberParentLabel } from "@/lib/admin-member-list";
import { MemberActionsMenu } from "./MemberActionsMenu";

type Props = {
  members: Member[];
  allMembers: Member[];
  onRowClick: (member: Member) => void;
  onPhoto: (member: Member) => void;
  onSetAlive: (id: number, isAlive: boolean) => void;
  onDelete: (member: Member) => void;
};

export function MembersTable({
  members,
  allMembers,
  onRowClick,
  onPhoto,
  onSetAlive,
  onDelete,
}: Props) {
  const byId = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers]);

  if (members.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No members match your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[60px]">Gen</TableHead>
            <TableHead className="hidden md:table-cell">Parents</TableHead>
            <TableHead className="hidden lg:table-cell">Location</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="w-[52px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow
              key={m.id}
              className="cursor-pointer"
              onClick={() => onRowClick(m)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="xs" />
                  <span className="font-medium">{m.full_name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{m.generation_level}</TableCell>
              <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
                {memberParentLabel(m, byId)}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {m.current_location ?? "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <StatusBadge m={m} />
              </TableCell>
              <TableCell>
                <MemberActionsMenu
                  member={m}
                  onPhoto={onPhoto}
                  onSetAlive={onSetAlive}
                  onDelete={onDelete}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
