import { useState } from "react";

import { AddFamilyForm } from "@/components/AddFamilyForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FamilyUnit } from "@/lib/admin-family-units";
import type { SubmitFamilyPayload, SubmissionMemberIds } from "@/lib/family";

type Props = {
  unit: FamilyUnit;
  onSave: (form: SubmitFamilyPayload, memberIds: SubmissionMemberIds) => Promise<void>;
  children: React.ReactNode;
};

export function EditFamilyDialog({ unit, onSave, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Family</DialogTitle>
        </DialogHeader>
        <AddFamilyForm
          initialFamilyUnit={unit}
          onEditUnit={async (form, memberIds) => {
            await onSave(form, memberIds);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
