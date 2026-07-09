import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/MemberAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { buildMap } from "@/lib/lineage";
import { cn } from "@/lib/utils";
import {
  buildChildrenCounts,
  duplicateDetailFields,
  fieldDiffKeys,
  pickSuggestedKeep,
} from "../duplicate-member-details";
import { duplicateGroupKey } from "../utils";
import type { AdminActions, AdminData } from "../types";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

export function DuplicatesPage({ data, actions }: Props) {
  const { duplicates } = data;
  const byId = useMemo(() => buildMap(data.all), [data.all]);
  const childrenMap = useMemo(() => buildChildrenCounts(data.all), [data.all]);

  if (duplicates.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No duplicate names detected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Compare matching names side by side. Highlighted fields differ within a group — use those to decide which
        record to keep. The suggested keep is usually the approved record with parents, children, or a photo.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {duplicates.map((group) => {
          const groupKey = duplicateGroupKey(group);
          const suggested = pickSuggestedKeep(group, childrenMap);
          const memberFields = group.map((m) => duplicateDetailFields(m, byId, childrenMap.get(m.id)));
          const diffKeys = fieldDiffKeys(memberFields);

          return (
            <Card key={groupKey}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{group[0].full_name}</p>
                    <p className="text-xs text-muted-foreground">{group.length} records with this name</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => actions.dismissDuplicateGroup(groupKey)}>
                    Not duplicates — dismiss
                  </Button>
                </div>

                <div className="space-y-3">
                  {group.map((m, idx) => {
                    const fields = memberFields[idx];
                    const isSuggested = m.id === suggested.id;
                    const canDelete = !m.is_root;

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-xl border p-3",
                          isSuggested ? "border-primary/40 bg-primary/5" : "bg-muted/15",
                        )}
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="md" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{m.full_name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <StatusBadge m={m} />
                                {isSuggested ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    <CheckCircle2 className="size-3" />
                                    Suggested keep
                                  </span>
                                ) : null}
                                {m.is_root ? (
                                  <span className="rounded-full bg-root/15 px-2 py-0.5 text-[10px] font-semibold text-root">
                                    Root — do not delete
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {canDelete ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                const msg = `Remove duplicate "${m.full_name}" (ID #${m.id})?\n\nThis permanently deletes the record. Keep the suggested record unless you are sure this is the wrong one.`;
                                if (confirm(msg)) actions.remove(m.id);
                              }}
                            >
                              Remove
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Protected</span>
                          )}
                        </div>

                        <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
                          {fields.map((f) => (
                            <div
                              key={f.key}
                              className={cn(
                                "rounded-md px-2 py-1 text-xs",
                                diffKeys.has(f.key) && "bg-amber-500/10 ring-1 ring-amber-500/25",
                              )}
                            >
                              <dt className="font-medium text-muted-foreground">{f.label}</dt>
                              <dd className="mt-0.5 break-words font-medium text-foreground">{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>

                {diffKeys.size === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    All shown fields match — check photos and tree links carefully before removing.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
