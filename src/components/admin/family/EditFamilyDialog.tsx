import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AddFamilyForm } from "@/components/AddFamilyForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buildFamilyUnits, type FamilyUnit } from "@/lib/admin-family-units";
import { fetchAllMembers, fetchWives, type SubmitFamilyPayload, type SubmissionMemberIds } from "@/lib/family";

type Props = {
  unit: FamilyUnit;
  onSave: (form: SubmitFamilyPayload, memberIds: SubmissionMemberIds) => Promise<void>;
  children: React.ReactNode;
};

export function EditFamilyDialog({ unit, onSave, children }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [freshUnit, setFreshUnit] = useState<FamilyUnit | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFreshUnit(null);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin"] }),
        qc.invalidateQueries({ queryKey: ["members"] }),
        qc.invalidateQueries({ queryKey: ["wives"] }),
      ]);
      const [approved, wives] = await Promise.all([
        qc.fetchQuery({ queryKey: ["admin", "approved"], queryFn: () => fetchAllMembers(false) }),
        qc.fetchQuery({ queryKey: ["wives"], queryFn: fetchWives }),
      ]);
      const rebuilt = buildFamilyUnits(approved, wives).find((u) => u.key === unit.key) ?? unit;
      setFreshUnit(rebuilt);
    } finally {
      setLoading(false);
    }
  };

  const editUnit = freshUnit ?? unit;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Family</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Refreshing family data…</p>
        ) : (
          <AddFamilyForm
            key={`${editUnit.key}-${editUnit.memberIds.join(",")}`}
            initialFamilyUnit={editUnit}
            onEditUnit={async (form, memberIds) => {
              await onSave(form, memberIds);
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
