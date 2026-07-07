import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/MemberAvatar";
import { disambiguatorLabel } from "@/lib/member-disambiguator";
import { statusOf, type Member } from "@/lib/family";

type Props = {
  member: Member;
  byId: Map<number, Member>;
  onOpen?: (memberId: number) => void;
};

export function MemberChip({ member, byId, onOpen }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
      onClick={() => onOpen?.(member.id)}
    >
      <MemberAvatar name={member.full_name} photoUrl={member.photo_url} status={statusOf(member)} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{member.full_name}</span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {disambiguatorLabel(member, byId)}
        </span>
      </span>
    </Button>
  );
}

