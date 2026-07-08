import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Member } from "@/lib/family";
import { statusOf } from "@/lib/family";
import { useI18n } from "@/lib/i18n";
import { disambiguatorLabel } from "@/lib/member-disambiguator";
import type { DuplicateNameHit } from "@/lib/submission-validate";

type Props = {
  hit: DuplicateNameHit | null;
  byId: Map<number, Member>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinkSame: (memberId: number) => void;
  onDistinct: () => void;
};

function memberDuplicateContext(member: Member, byId: Map<number, Member>): string {
  const bits = [disambiguatorLabel(member, byId)];
  if (member.birth_year) bits.push(`b. ${member.birth_year}`);
  if (member.current_location) bits.push(member.current_location);
  return bits.join(" · ");
}

export function DuplicateNameDialog({ hit, byId, open, onOpenChange, onLinkSame, onDistinct }: Props) {
  const { t } = useI18n();
  if (!hit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("duplicateConfirmTitle")}</DialogTitle>
          <DialogDescription>{t("duplicateConfirmDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">{hit.name}</p>
          {hit.members.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("duplicateExistingMatch")}</p>
              {hit.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <MemberAvatar name={m.full_name} photoUrl={m.photo_url} status={statusOf(m)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{memberDuplicateContext(m, byId)}</p>
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => onLinkSame(m.id)}>
                    {t("duplicateSamePerson")}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" variant="secondary" className="w-full" onClick={onDistinct}>
            {t("duplicateDifferentPerson")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
