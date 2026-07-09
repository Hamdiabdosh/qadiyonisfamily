import { useEffect, useMemo, useState } from "react";
import { Link2, Skull, Trash2, UserCheck } from "lucide-react";

import { MemberAvatar } from "@/components/MemberAvatar";
import { MemberPhotoUpload } from "@/components/MemberPhotoUpload";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildUnitLookup, type FamilyUnit } from "@/lib/admin-family-units";
import type { Member } from "@/lib/family";
import { memberParentLabel } from "@/lib/admin-member-list";
import { copyMemberInviteLink } from "./member-actions";

type Props = {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allMembers: Member[];
  units: FamilyUnit[];
  onSetAlive: (id: number, isAlive: boolean) => void;
  onDelete: (member: Member) => void;
  onEditInFamily?: (unitKey: string) => void;
};

export function MemberDetailSheet({
  member,
  open,
  onOpenChange,
  allMembers,
  units,
  onSetAlive,
  onDelete,
  onEditInFamily,
}: Props) {
  const [current, setCurrent] = useState<Member | null>(member);

  useEffect(() => {
    setCurrent(member);
  }, [member]);

  const byId = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers]);
  const unitLookup = useMemo(() => buildUnitLookup(units), [units]);

  const familyUnit = useMemo(() => {
    if (!current) return null;
    return unitLookup.byFather.get(current.id) ?? unitLookup.byMother.get(current.id) ?? null;
  }, [current, unitLookup]);

  if (!current) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <MemberAvatar name={current.full_name} photoUrl={current.photo_url} size="lg" />
            <div className="min-w-0 text-left">
              <SheetTitle className="truncate">{current.full_name}</SheetTitle>
              <SheetDescription>Generation {current.generation_level}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <StatusBadge m={current} />

          <div className="space-y-1 text-sm">
            <p className="text-xs font-medium uppercase text-muted-foreground">Parents</p>
            <p>{memberParentLabel(current, byId)}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs font-medium uppercase text-muted-foreground">Location</p>
            <p>{current.current_location ?? "—"}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Photo</p>
            <MemberPhotoUpload
              member={current}
              onUpdated={(patch) => setCurrent((s) => (s ? { ...s, ...patch } : s))}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" onClick={() => copyMemberInviteLink(current.id)}>
              <Link2 className="size-4 mr-2" />
              Copy invite link
            </Button>
            {!current.is_root && (
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => onSetAlive(current.id, !current.is_alive)}
              >
                {current.is_alive ? (
                  <>
                    <Skull className="size-4 mr-2" />
                    Mark as deceased
                  </>
                ) : (
                  <>
                    <UserCheck className="size-4 mr-2" />
                    Mark as alive
                  </>
                )}
              </Button>
            )}
            <Button variant="destructive" className="justify-start" onClick={() => onDelete(current)}>
              <Trash2 className="size-4 mr-2" />
              Delete member
            </Button>
          </div>

          {familyUnit && onEditInFamily && (
            <>
              <Separator />
              <Button variant="ghost" className="w-full text-sm" onClick={() => onEditInFamily(familyUnit.key)}>
                Edit in family view
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
