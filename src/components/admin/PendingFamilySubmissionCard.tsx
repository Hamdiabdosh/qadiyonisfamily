import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";

import { ChildrenByMotherSection } from "@/components/ChildrenByMotherSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  childrenBucketsFromFlat,
  flattenChildrenBuckets,
  syncChildrenBucketsForMotherCount,
  type ChildrenBucket,
} from "@/lib/children-by-mother";
import type { Member, PendingFamilySubmission, SubmitFamilyPayload } from "@/lib/family";
import { collectKinLinkJumps, formatKinLinkJumpAlert } from "@/lib/kin-anchor";
import { findSubmissionDuplicates, submissionMemberIds } from "@/components/admin/utils";
import { useI18n } from "@/lib/i18n";

type Props = {
  submission: PendingFamilySubmission;
  allMembers: Member[];
  otherSubmissions: PendingFamilySubmission[];
  onSave: (id: string, form: SubmitFamilyPayload) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
};

function emptyMother() {
  return { name: "", alive: true, existingId: null, inKin: false, kinSide: null, kinAnchorId: null };
}

export function PendingFamilySubmissionCard({
  submission,
  allMembers,
  otherSubmissions,
  onSave,
  onApprove,
  onReject,
}: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<SubmitFamilyPayload>(() => structuredClone(submission.form));
  const [childrenByMother, setChildrenByMother] = useState<Record<number, ChildrenBucket>>(() =>
    childrenBucketsFromFlat(submission.form.children),
  );
  const [activeMotherTab, setActiveMotherTab] = useState("0");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const namedMothers = useMemo(() => form.mothers.filter((m) => m.name.trim()), [form.mothers]);

  useEffect(() => {
    setForm(structuredClone(submission.form));
    setChildrenByMother(childrenBucketsFromFlat(submission.form.children));
    setActiveMotherTab("0");
  }, [submission.id]);

  useEffect(() => {
    setChildrenByMother((prev) => {
      const { buckets, removedNamedChildren } = syncChildrenBucketsForMotherCount(prev, namedMothers.length);
      if (removedNamedChildren > 0) toast.warning(t("childrenRemovedWithMother"));
      return buckets;
    });
    setActiveMotherTab((tab) => (Number(tab) >= Math.max(namedMothers.length, 1) ? "0" : tab));
  }, [namedMothers.length, t]);

  const effectiveForm = useMemo(
    () => ({ ...form, children: flattenChildrenBuckets(childrenByMother) }),
    [form, childrenByMother],
  );

  const approvedMembers = useMemo(() => allMembers.filter((m) => m.is_approved), [allMembers]);

  const duplicateWarnings = useMemo(
    () =>
      findSubmissionDuplicates(effectiveForm, allMembers, {
        excludeMemberIds: submissionMemberIds(submission),
        excludeSubmissionId: submission.id,
        otherSubmissions,
      }),
    [effectiveForm, allMembers, otherSubmissions, submission],
  );

  const kinLinkJumps = useMemo(
    () => collectKinLinkJumps(effectiveForm.father, namedMothers, approvedMembers),
    [effectiveForm.father, namedMothers, approvedMembers],
  );

  const submittedAt = new Date(submission.created_at).toLocaleString();
  const memberCount =
    (submission.member_ids.fatherId ? 1 : 0) +
    submission.member_ids.motherIds.length +
    submission.member_ids.childIds.length;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(submission.id, effectiveForm);
      toast.success("Family submission saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (duplicateWarnings.length > 0) {
      const lines = duplicateWarnings
        .map((d) => {
          const parts: string[] = [];
          if (d.members.length) {
            parts.push(
              `matches ${d.members.map((m) => `#${m.id} ${m.full_name}${m.is_approved ? "" : " (pending)"}`).join(", ")}`,
            );
          }
          if (d.otherPending.length) {
            parts.push(
              `also in pending submission by ${d.otherPending.map((p) => p.submitter).join(", ")}`,
            );
          }
          return `• ${d.name} (${d.role}): ${parts.join("; ")}`;
        })
        .join("\n");
      if (!confirm(`Possible duplicate names detected:\n\n${lines}\n\nApprove this family anyway?`)) return;
    }
    setApproving(true);
    try {
      await onSave(submission.id, effectiveForm);
      await onApprove(submission.id);
      toast.success("Family approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApproving(false);
    }
  };

  const reject = async () => {
    if (!confirm("Reject and delete this entire family submission?")) return;
    setRejecting(true);
    try {
      await onReject(submission.id);
      toast.success("Submission rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setRejecting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {form.father.name.trim() || "Family submission"}
              {form.mothers.some((m) => m.name.trim()) && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  & {form.mothers.filter((m) => m.name.trim()).map((m) => m.name).join(", ")}
                </span>
              )}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Submitted {submittedAt} by {form.submitter.name || "—"} ({form.submitter.phone || "—"})
              {submission.legacy && " · legacy batch"}
              {memberCount > 0 && ` · ${memberCount} new member(s)`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={saving || approving || rejecting} onClick={() => void save()}>
              {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Save className="size-3 mr-1" />}
              Save edits
            </Button>
            <Button size="sm" disabled={saving || approving || rejecting} onClick={() => void approve()}>
              {approving ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Check className="size-3 mr-1" />}
              Approve all
            </Button>
            <Button size="sm" variant="destructive" disabled={saving || approving || rejecting} onClick={() => void reject()}>
              {rejecting ? <Loader2 className="size-3 mr-1 animate-spin" /> : <X className="size-3 mr-1" />}
              Reject
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">
        {kinLinkJumps.length > 0 ? (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium text-foreground">Lineage gap — verify kin link</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {kinLinkJumps.map((jump) => (
                    <li key={`${jump.parentRole}-${jump.parentName}-${jump.anchorName}`}>
                      {formatKinLinkJumpAlert(jump)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {duplicateWarnings.length > 0 ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium text-amber-900 dark:text-amber-100">Possible duplicate names</p>
                <ul className="space-y-1 text-xs text-amber-950/80 dark:text-amber-50/80">
                  {duplicateWarnings.map((d) => (
                    <li key={`${d.role}-${d.name}`}>
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground"> ({d.role})</span>
                      {d.members.length > 0 ? (
                        <span>
                          {" "}
                          — already in tree:{" "}
                          {d.members.map((m) => `#${m.id} ${m.full_name}`).join(", ")}
                        </span>
                      ) : null}
                      {d.otherPending.length > 0 ? (
                        <span>
                          {d.members.length > 0 ? ";" : " —"}
                          {" "}
                          also pending from {d.otherPending.map((p) => p.submitter).join(", ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Parents</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-xs">Father</Label>
              <Input
                value={form.father.name}
                onChange={(e) => setForm((p) => ({ ...p, father: { ...p.father, name: e.target.value } }))}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.father.alive}
                  onChange={(e) => setForm((p) => ({ ...p, father: { ...p.father, alive: e.target.checked } }))}
                />
                Alive
              </label>
              {form.father.existingId && (
                <p className="text-[10px] text-muted-foreground">Linked to existing member #{form.father.existingId}</p>
              )}
            </div>
            <div className="space-y-2">
              {form.mothers.map((mo, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mother {form.mothers.length > 1 ? `#${i + 1}` : ""}</Label>
                    {i > 0 && (
                      <button
                        type="button"
                        className="text-muted-foreground"
                        onClick={() => setForm((p) => ({ ...p, mothers: p.mothers.filter((_, x) => x !== i) }))}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  <Input
                    value={mo.name}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        mothers: p.mothers.map((m, x) => (x === i ? { ...m, name: e.target.value } : m)),
                      }))
                    }
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={mo.alive}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          mothers: p.mothers.map((m, x) => (x === i ? { ...m, alive: e.target.checked } : m)),
                        }))
                      }
                    />
                    Alive
                  </label>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setForm((p) => ({ ...p, mothers: [...p.mothers, emptyMother()] }))}
              >
                <Plus className="size-3 mr-1" />
                Add wife
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Current location</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Children (optional)</h3>
          <ChildrenByMotherSection
            variant="admin"
            namedMothers={namedMothers}
            childrenByMother={childrenByMother}
            setChildrenByMother={setChildrenByMother}
            activeMotherTab={activeMotherTab}
            onActiveMotherTabChange={setActiveMotherTab}
            idPrefix={`pending-${submission.id}`}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Submitter</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full name</Label>
              <Input
                value={form.submitter.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, submitter: { ...p.submitter, name: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={form.submitter.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, submitter: { ...p.submitter, phone: e.target.value } }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
