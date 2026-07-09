import { useState } from "react";

import { MemberPhotoUpload } from "@/components/MemberPhotoUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Member } from "@/lib/family";

type Props = {
  member: Member;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function MemberPhotoDialog({ member, children, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [current, setCurrent] = useState(member);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{member.full_name}</DialogTitle>
        </DialogHeader>
        <MemberPhotoUpload
          member={current}
          onUpdated={(patch) => setCurrent((s) => ({ ...s, ...patch }))}
        />
      </DialogContent>
    </Dialog>
  );
}
