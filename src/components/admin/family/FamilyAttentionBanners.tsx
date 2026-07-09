import { Link } from "@tanstack/react-router";
import { AlertCircle, Copy } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AdminData } from "../types";

type Props = {
  data: AdminData;
};

export function FamilyAttentionBanners({ data }: Props) {
  const incompleteCount = data.incomplete.length;
  const duplicateCount = data.duplicates.length;

  if (incompleteCount === 0 && duplicateCount === 0) return null;

  return (
    <div className="space-y-2">
      {incompleteCount > 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            {incompleteCount} member{incompleteCount === 1 ? "" : "s"} need parent links (not linked by marriage).{" "}
            <Link to="/admin" search={{ view: "incomplete" }} className="font-medium underline underline-offset-2">
              Fix in Incomplete
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {duplicateCount > 0 && (
        <Alert>
          <Copy className="size-4" />
          <AlertDescription>
            {duplicateCount} possible duplicate group{duplicateCount === 1 ? "" : "s"}.{" "}
            <Link to="/admin" search={{ view: "duplicates" }} className="font-medium underline underline-offset-2">
              Review duplicates
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
